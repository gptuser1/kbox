import { describe, it, expect } from 'vitest';
import { rasterizeQr } from '../src/frontend/plugins/qr-transfer/qr-raster';

const WHITE = 0xffffffff;
const BLACK = 0xff000000;

describe('rasterizeQr', () => {
  it('a single dark module with no margin is one black pixel', () => {
    const { size, pixels } = rasterizeQr(1, [1], 0);
    expect(size).toBe(1);
    expect([...pixels]).toEqual([BLACK]);
  });

  it('the margin surrounds the modules with white on every side', () => {
    const { size, pixels } = rasterizeQr(1, [1], 2);
    expect(size).toBe(5);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const expected = x === 2 && y === 2 ? BLACK : WHITE;
        expect(pixels[y * size + x]).toBe(expected);
      }
    }
  });

  it('modules map row-major and truthy means dark', () => {
    // ▓░ / ░▓ checkerboard
    const { size, pixels } = rasterizeQr(2, [1, 0, 0, 1], 0);
    expect(size).toBe(2);
    expect([...pixels]).toEqual([BLACK, WHITE, WHITE, BLACK]);
  });

  it('an all-light matrix rasterizes to all white', () => {
    const { size, pixels } = rasterizeQr(3, new Uint8Array(9), 1);
    expect(size).toBe(5);
    expect([...pixels].every((p) => p === WHITE)).toBe(true);
  });

  it('pixel values are the RGBA bytes an ImageData buffer expects', () => {
    const { pixels } = rasterizeQr(1, [1], 1);
    const bytes = new Uint8Array(pixels.buffer);
    // little-endian u32 0xff000000 → R,G,B = 0 and A = 255
    const center = 4 * (1 * 3 + 1);
    expect([...bytes.slice(center, center + 4)]).toEqual([0, 0, 0, 255]);
    // and the white corner is R,G,B,A all 255
    expect([...bytes.slice(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});