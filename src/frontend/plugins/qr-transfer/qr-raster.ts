const WHITE = 0xffffffff;
const BLACK = 0xff000000;

export interface QrRaster {
  size: number;
  pixels: Uint32Array<ArrayBuffer>;
}

export function rasterizeQr(moduleCount: number, modules: ArrayLike<number>, margin: number): QrRaster {
  const size = moduleCount + 2 * margin;
  const pixels = new Uint32Array(size * size);
  pixels.fill(WHITE);
  for (let y = 0; y < moduleCount; y++) {
    const row = (y + margin) * size + margin;
    const src = y * moduleCount;
    for (let x = 0; x < moduleCount; x++) {
      if (modules[src + x]) pixels[row + x] = BLACK;
    }
  }
  return { size, pixels };
}