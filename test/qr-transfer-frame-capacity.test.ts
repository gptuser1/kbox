import { describe, it, expect } from 'vitest';
import {
  MAX_SOURCE_BLOCKS,
  blockLength,
  fitsInOneStream,
  minimumFrameBytes,
  sourceBlockCount,
} from '../src/frontend/plugins/qr-transfer/frame-capacity';
import { HEADER_LEN, MAX_FILE_BYTES } from '../src/frontend/plugins/qr-transfer/protocol';

describe('blockLength', () => {
  it('the header takes its cut off every frame', () => {
    expect(blockLength(2953)).toBe(2953 - HEADER_LEN);
    expect(blockLength(500)).toBe(480);
  });
});

describe('sourceBlockCount', () => {
  it('rounds up because a partial block still needs a frame', () => {
    expect(sourceBlockCount(1, 2953)).toBe(1);
    expect(sourceBlockCount(2933, 2953)).toBe(1);
    expect(sourceBlockCount(2934, 2953)).toBe(2);
    expect(sourceBlockCount(10 * 2933, 2953)).toBe(10);
  });
});

describe('fitsInOneStream', () => {
  it('the block ceiling bites well below the file size limit', () => {
    expect(fitsInOneStream(30 * 1024 * 1024, 500)).toBe(false);
    expect(fitsInOneStream(20 * 1024 * 1024, 500)).toBe(true);
    expect(fitsInOneStream(MAX_FILE_BYTES, 2953)).toBe(true);
  });
});

describe('minimumFrameBytes', () => {
  it('is the smallest frame size that actually fits', () => {
    for (const payload of [1, 1000, 30 * 1024 * 1024, 64 * 1024 * 1024, MAX_FILE_BYTES]) {
      const minimum = minimumFrameBytes(payload);
      expect(fitsInOneStream(payload, minimum)).toBe(true);
      if (sourceBlockCount(payload, minimum) > 1) {
        expect(fitsInOneStream(payload, minimum - 1)).toBe(false);
      }
    }
  });
});