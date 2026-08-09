import { describe, it, expect } from 'vitest';
import {
  LTEncoder,
  LTDecoder,
  cycleLength,
  dlog,
  frameComposition,
} from '../src/frontend/plugins/qr-transfer/fountain';
import { fnv1a, splitmix32 } from '../src/frontend/plugins/qr-transfer/protocol';

// ─── dlog ───

describe('dlog', () => {
  it('is bit-exact against its recorded values', () => {
    const golden: [number, number][] = [
      [1, 0],
      [1.5, 0.4054651081081644],
      [2, 0.6931471805599453],
      [2.718281828459045, 1],
      [10, 2.3025850929940455],
      [20, 2.995732273553991],
      [200, 5.298317366548036],
      [2000, 7.600902459542082],
      [2986, 8.001689978099137],
      [44000, 10.691944912900398],
      [131070, 11.78348681061359],
    ];
    for (const [x, expected] of golden) {
      expect(dlog(x)).toBe(expected);
    }
  });

  it('is accurate to within 1 ulp of Math.log but is NOT interchangeable with it', () => {
    let differing = 0;
    let worstUlp = 0;
    let samples = 0;
    for (let k = 2; k <= 20000; k++) {
      for (const x of [k, k / 0.5]) {
        samples++;
        const ours = dlog(x);
        const native = Math.log(x);
        if (ours !== native) differing++;
        worstUlp = Math.max(worstUlp, Math.abs(ours - native) / (Math.abs(native) * Number.EPSILON));
      }
    }
    expect(worstUlp).toBeLessThanOrEqual(2);
    expect(differing).toBeGreaterThan(0);
  });
});

// ─── frameComposition ───

describe('frameComposition', () => {
  it('is systematic in the sweep, mid-degree after', () => {
    for (const k of [1, 17, 179, 4096]) {
      expect(cycleLength(k)).toBe(2 * k);
      for (const pos of [0, k >> 1, k - 1]) {
        expect(frameComposition(k, 9, pos)).toEqual([pos]);
        // The sweep restarts every cycle
        expect(frameComposition(k, 9, pos + 6 * cycleLength(k))).toEqual([pos]);
      }
      for (const seq of [k, k + 1, 2 * k - 1]) {
        const idx = frameComposition(k, 9, seq);
        expect(idx.length).toBeGreaterThanOrEqual(Math.min(k, 4));
        expect(idx.length).toBeLessThanOrEqual(Math.min(k, 24));
        expect(new Set(idx).size).toBe(idx.length);
        for (const b of idx) {
          expect(Number.isInteger(b) && b >= 0 && b < k).toBe(true);
        }
      }
    }
  });
});

// ─── LTEncoder / LTDecoder ───

function testPayload(byteLength: number): Uint8Array {
  const payload = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) payload[i] = (i * 37 + (i >> 8) * 11) & 0xff;
  return payload;
}

describe('LTEncoder', () => {
  it('produces an encoded stream byte-identical to its recorded fingerprint', () => {
    const golden: [number, number, number, string][] = [
      [1, 64, 1, 'k=1 fnv=0xf6a115c5'],
      [23, 64, 7, 'k=23 fnv=0x4a5d3eaa'],
      [179, 2933, 4242, 'k=179 fnv=0x54f78d05'],
      [716, 1445, 65535, 'k=716 fnv=0x75b73b85'],
    ];
    for (const [k, blockLen, sessionId, expected] of golden) {
      const encoder = new LTEncoder(testPayload(k * blockLen - 7), blockLen, sessionId);
      const stream = new Uint8Array(64 * blockLen);
      for (let seq = 0; seq < 64; seq++) stream.set(encoder.encode(seq), seq * blockLen);
      const actual = `k=${encoder.k} fnv=0x${fnv1a(stream).toString(16).padStart(8, '0')}`;
      expect(actual).toBe(expected);
    }
  });

  it('every frame is exactly blockLen bytes', () => {
    const blockLen = 1445;
    const encoder = new LTEncoder(testPayload(blockLen * 5 + 1), blockLen, 3);
    expect(encoder.k).toBe(6);
    for (let seq = 0; seq < 200; seq++) {
      expect(encoder.encode(seq).length).toBe(blockLen);
    }
  });
});

interface RoundTrip {
  frames: number;
  overhead: number;
  wallClock: number;
  recovered: Uint8Array | null;
}

function roundTrip(byteLength: number, blockLen: number, sessionId: number, dropRate = 0): RoundTrip {
  const payload = testPayload(byteLength);
  const encoder = new LTEncoder(payload, blockLen, sessionId);
  const decoder = new LTDecoder(encoder.k, blockLen, sessionId, byteLength);
  const rnd = splitmix32(sessionId);
  let seq = 0;
  const ceiling = encoder.k * 80 + 5000;
  while (!decoder.isComplete && seq < ceiling) {
    if (rnd() * 2 ** -32 >= dropRate) decoder.addFrame(seq, encoder.encode(seq));
    seq++;
  }
  return {
    frames: decoder.framesNew,
    overhead: decoder.framesNew / encoder.k,
    wallClock: seq / encoder.k,
    recovered: decoder.assemble(),
  };
}

describe('LTDecoder — round trip', () => {
  it('a re-swept block the receiver already solved counts as redundant, not progress', () => {
    const blockLen = 64;
    const payload = testPayload(23 * blockLen - 7);
    const encoder = new LTEncoder(payload, blockLen, 77);
    const decoder = new LTDecoder(encoder.k, blockLen, 77, payload.length);

    decoder.addFrame(0, encoder.encode(0));
    expect(decoder.solvedCount).toBe(1);
    expect(decoder.framesRedundant).toBe(0);

    // Same block, next cycle: a NEW seq carrying nothing the receiver lacks.
    const nextCycle = cycleLength(encoder.k);
    decoder.addFrame(nextCycle, encoder.encode(nextCycle));
    expect(decoder.framesNew).toBe(2);
    expect(decoder.framesDup).toBe(0);
    expect(decoder.framesRedundant).toBe(1);
    expect(decoder.solvedCount).toBe(1);

    // An unsolved block's sweep frame is information, never redundant.
    decoder.addFrame(1, encoder.encode(1));
    expect(decoder.framesRedundant).toBe(1);
    expect(decoder.solvedCount).toBe(2);
  });

  it('a payload survives the fountain exactly', () => {
    const cases: [number, number][] = [
      [7, 2933],
      [2933, 2933],
      [50_000, 1445],
      [512 * 1024, 2933],
      [2 * 1024 * 1024, 2933],
    ];
    for (const [byteLength, blockLen] of cases) {
      const { recovered } = roundTrip(byteLength, blockLen, 11);
      expect(recovered).not.toBeNull();
      expect(recovered).toEqual(testPayload(byteLength));
    }
  });

  it('dropping 30% of frames costs time, never correctness', () => {
    const { recovered, overhead, wallClock } = roundTrip(512 * 1024, 2933, 23, 0.3);
    expect(recovered).not.toBeNull();
    expect(recovered).toEqual(testPayload(512 * 1024));
    expect(wallClock).toBeLessThan(2.8);
    expect(overhead).toBeLessThan(1.8);
  });

  it('a receiver that catches one clean sweep pays zero fountain overhead', () => {
    const byteLength = 200_000;
    const blockLen = 1445;
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, 55);
    const decoder = new LTDecoder(encoder.k, blockLen, 55, byteLength);
    for (let seq = 0; seq < encoder.k; seq++) decoder.addFrame(seq, encoder.encode(seq));
    expect(decoder.isComplete).toBe(true);
    expect(decoder.framesNew).toBe(encoder.k);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('a receiver joining mid-cycle completes without a handshake', () => {
    const byteLength = 512 * 1024;
    const blockLen = 2933;
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, 91);
    const decoder = new LTDecoder(encoder.k, blockLen, 91, byteLength);
    const start = Math.floor(encoder.k / 3);
    let seq = start;
    while (!decoder.isComplete && seq < start + encoder.k * 4) {
      decoder.addFrame(seq, encoder.encode(seq));
      seq++;
    }
    expect(decoder.isComplete).toBe(true);
    expect(decoder.assemble()).toEqual(payload);
    const wallClock = (seq - start) / encoder.k;
    expect(wallClock).toBeLessThan(1.7);
  });

  it('frames decode in any order', () => {
    const byteLength = 200_000;
    const blockLen = 1445;
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, 77);

    const captured: [number, Uint8Array][] = [];
    for (let seq = 0; seq < Math.ceil(encoder.k * 2.5); seq++) {
      captured.push([seq, encoder.encode(seq)]);
    }
    const shuffled = [...captured];
    const rnd = splitmix32(5);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rnd() % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }

    const decoder = new LTDecoder(encoder.k, blockLen, 77, byteLength);
    for (const [seq, block] of shuffled) {
      decoder.addFrame(seq, block);
      if (decoder.isComplete) break;
    }
    expect(decoder.isComplete).toBe(true);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('repeated frames are counted but never corrupt the decode', () => {
    const byteLength = 60_000;
    const blockLen = 1445;
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, 31);
    const decoder = new LTDecoder(encoder.k, blockLen, 31, byteLength);

    let seq = 0;
    while (!decoder.isComplete) {
      const block = encoder.encode(seq);
      decoder.addFrame(seq, block);
      decoder.addFrame(seq, block); // simulate camera re-reading the same frame
      seq++;
    }
    expect(decoder.framesDup).toBeGreaterThanOrEqual(decoder.framesNew - 1);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('a single-block payload completes on its first frame', () => {
    const payload = testPayload(900);
    const encoder = new LTEncoder(payload, 2933, 5);
    expect(encoder.k).toBe(1);
    const decoder = new LTDecoder(1, 2933, 5, 900);
    decoder.addFrame(0, encoder.encode(0));
    expect(decoder.isComplete).toBe(true);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('an incomplete decoder assembles nothing', () => {
    const encoder = new LTEncoder(testPayload(50_000), 1445, 13);
    const decoder = new LTDecoder(encoder.k, 1445, 13, 50_000);
    decoder.addFrame(0, encoder.encode(0));
    expect(decoder.isComplete).toBe(false);
    expect(decoder.assemble()).toBeNull();
  });
});