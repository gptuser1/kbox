import { describe, it, expect } from 'vitest';
import {
  HEADER_LEN,
  type FrameHeader,
  isPrecompressedType,
  packFile,
  packFrame,
  parseFrame,
  streamIdentity,
  unpackFile,
  verifyFile,
} from '../src/frontend/plugins/qr-transfer/protocol';

describe('packFile / unpackFile', () => {
  it('arbitrary file metadata and bytes survive the optical container', async () => {
    const source = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    const packed = await packFile('résumé.bin', 'application/octet-stream', source);
    const recovered = await unpackFile(packed.container);

    expect(packed.compression).toBe('none');
    expect(recovered.name).toBe('résumé.bin');
    expect(recovered.type).toBe('application/octet-stream');
    expect(recovered.bytes).toEqual(source);
    expect(await verifyFile(recovered)).toBe(true);
  });

  it('SHA-256 verification rejects changed file bytes', async () => {
    const packed = await packFile('message.txt', 'text/plain', new TextEncoder().encode('hello'));
    const recovered = await unpackFile(packed.container);
    recovered.bytes[0] ^= 0xff;
    expect(await verifyFile(recovered)).toBe(false);
  });

  it('compressible files use gzip and recover exactly', async () => {
    const source = new TextEncoder().encode('decimen optical transfer\n'.repeat(4_000));
    const packed = await packFile('notes.txt', 'text/plain', source);
    const recovered = await unpackFile(packed.container);

    expect(packed.compression).toBe('gzip');
    expect(packed.transmittedSize).toBeLessThan(source.length / 10);
    expect(recovered.compression).toBe('gzip');
    expect(recovered.bytes).toEqual(source);
    expect(await verifyFile(recovered)).toBe(true);
  });

  it('gzip output length is bounded by the declared original size', async () => {
    const source = new TextEncoder().encode('bounded output\n'.repeat(1_000));
    const packed = await packFile('bounded.txt', 'text/plain', source);
    const malformed = packed.container.slice();
    new DataView(malformed.buffer).setUint32(9, source.length + 1, true);
    await expect(unpackFile(malformed)).rejects.toThrow(/gzip|length/);
  });

  it('malformed optical containers are rejected', async () => {
    await expect(unpackFile(new Uint8Array(49))).rejects.toThrow(/header/);
  });

  it('the receiver sanitises the filename rather than trusting the sender', async () => {
    const cases: [string, string][] = [
      ['../../etc/passwd', 'passwd'],
      ['C:\\Windows\\System32\\drivers\\etc\\hosts', 'hosts'],
      ['évidence.pdf', 'évidence.pdf'],
      ['report v2 (final).tar.gz', 'report v2 (final).tar.gz'],
    ];
    for (const [sent, expected] of cases) {
      const packed = await packFile(sent, 'application/octet-stream', new Uint8Array([1, 2, 3]));
      expect((await unpackFile(packed.container)).name).toBe(expected);
    }
  });

  it('filenames that sanitise away fall back to a safe default', async () => {
    for (const sent of ['..', '.', '/', '   ', '\u0000\u0007']) {
      const packed = await packFile(sent, 'application/octet-stream', new Uint8Array([1]));
      expect((await unpackFile(packed.container)).name).toBe('transfer.bin');
    }
  });

  it('a precompressed file is transmitted verbatim and still round-trips', async () => {
    const source = new Uint8Array(4096);
    for (let i = 0; i < source.length; i++) source[i] = (i * 2654435761) >>> 24;
    const packed = await packFile('photo.jpg', 'image/jpeg', source);

    expect(packed.compression).toBe('none');
    expect(packed.transmittedSize).toBe(source.length);
    const recovered = await unpackFile(packed.container);
    expect(recovered.bytes).toEqual(source);
    expect(await verifyFile(recovered)).toBe(true);
  });

  it('declaring a compressible type still gets gzip', async () => {
    const source = new TextEncoder().encode('the same line over and over\n'.repeat(2000));
    expect((await packFile('log.txt', 'text/plain', source)).compression).toBe('gzip');
    expect((await packFile('log.txt', 'image/jpeg', source)).compression).toBe('none');
  });
});

describe('packFrame / parseFrame', () => {
  it('the frame header is byte-for-byte what the wire expects', () => {
    const frame = packFrame(
      {
        sessionId: 0xbeef,
        seq: 0x01020304,
        k: 0x0111,
        blockLen: 6,
        totalLen: 0x00fedcba,
        payloadFnv: 0x89abcdef,
      },
      new Uint8Array([1, 2, 3, 4, 5, 6]),
    );
    expect(
      [...frame].map((b) => b.toString(16).padStart(2, '0')).join(' '),
    ).toBe('d1 0d ef be 04 03 02 01 11 01 06 00 ba dc fe 00 ef cd ab 89 01 02 03 04 05 06');
    expect(frame.length).toBe(HEADER_LEN + 6);

    const parsed = parseFrame(frame);
    expect(parsed).not.toBeNull();
    expect(parsed!.header).toEqual({
      sessionId: 0xbeef,
      seq: 0x01020304,
      k: 0x0111,
      blockLen: 6,
      totalLen: 0x00fedcba,
      payloadFnv: 0x89abcdef,
    });
    expect(parsed!.block).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('frames that are not ours, or not self-consistent, are rejected', () => {
    const good = packFrame(
      { sessionId: 1, seq: 2, k: 3, blockLen: 4, totalLen: 10, payloadFnv: 0 },
      new Uint8Array([9, 9, 9, 9]),
    );
    expect(parseFrame(good)).not.toBeNull();

    const wrongMagic = good.slice();
    wrongMagic[0] = 0xd2;
    expect(parseFrame(wrongMagic)).toBeNull();

    expect(parseFrame(good.subarray(0, HEADER_LEN))).toBeNull();
    expect(parseFrame(good.subarray(0, good.length - 1))).toBeNull();

    const zeroK = good.slice();
    new DataView(zeroK.buffer).setUint16(8, 0, true);
    expect(parseFrame(zeroK)).toBeNull();
  });
});

describe('streamIdentity', () => {
  it('changes with every field that must not drift mid-stream', () => {
    const base: FrameHeader = {
      sessionId: 7,
      seq: 0,
      k: 100,
      blockLen: 2933,
      totalLen: 293_300,
      payloadFnv: 0xdeadbeef,
    };
    const identity = streamIdentity(base);

    // seq is the one field that varies within a stream.
    expect(streamIdentity({ ...base, seq: 9999 })).toBe(identity);

    for (const field of ['sessionId', 'k', 'blockLen', 'totalLen', 'payloadFnv'] as const) {
      expect(streamIdentity({ ...base, [field]: base[field] + 1 })).not.toBe(identity);
    }
  });

  it('fields cannot be confused by the separator', () => {
    const a: FrameHeader = { sessionId: 1, seq: 0, k: 1, blockLen: 23, totalLen: 4, payloadFnv: 5 };
    const b: FrameHeader = { sessionId: 1, seq: 0, k: 12, blockLen: 3, totalLen: 4, payloadFnv: 5 };
    expect(streamIdentity(a)).not.toBe(streamIdentity(b));
  });
});

describe('isPrecompressedType', () => {
  it('gzip is skipped for formats it cannot help', () => {
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/heic',
      'video/mp4',
      'video/quicktime',
      'audio/mpeg',
      'audio/mp4',
      'audio/flac',
      'application/zip',
      'application/gzip',
      'application/x-7z-compressed',
      'application/vnd.rar',
      'application/epub+zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.spreadsheet',
      'IMAGE/JPEG',
      'image/jpeg; charset=binary',
    ]) {
      expect(isPrecompressedType(type)).toBe(true);
    }
  });

  it('gzip is still attempted for anything that might compress', () => {
    for (const type of [
      'text/plain',
      'text/csv',
      'application/json',
      'application/pdf',
      'application/wasm',
      'application/octet-stream',
      'application/vnd.decimen.snippet',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'image/x-icon',
      'audio/wav',
      'audio/x-aiff',
      '',
    ]) {
      expect(isPrecompressedType(type)).toBe(false);
    }
  });
});