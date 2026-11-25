import { describe, expect, it } from 'vitest';
import { PALETTES, dither, hexToRgb } from './dither.js';

const GRAY = PALETTES.find(p => p.name === 'GRAY').colors.map(hexToRgb);

// N×N image filled with one gray level
const flat = (N, v) => {
  const d = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < d.length; i += 4) { d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  return d;
};
const histogram = (d, pal) => {
  const h = pal.map(() => 0);
  for (let i = 0; i < d.length; i += 4) h[pal.findIndex(p => p[0] === d[i] && p[1] === d[i + 1] && p[2] === d[i + 2])]++;
  return h;
};

describe('dither', () => {
  it('parses hex colors', () => expect(hexToRgb('#8bac0f')).toEqual([139, 172, 15]));

  it('maps black and white to the palette ends', () => {
    const black = flat(4, 0), white = flat(4, 255);
    dither(black, 4, GRAY); dither(white, 4, GRAY);
    expect(histogram(black, GRAY)).toEqual([16, 0, 0, 0]);
    expect(histogram(white, GRAY)).toEqual([0, 0, 0, 16]);
  });

  it('only outputs palette colors, mixing the two nearest tones', () => {
    const d = flat(8, 102); // 0.4 → between tones 1 and 2
    dither(d, 8, GRAY);
    const h = histogram(d, GRAY);
    expect(h[0] + h[3]).toBe(0);
    expect(h[1]).toBeGreaterThan(h[2]);
    expect(h[1] + h[2]).toBe(64);
  });

  it('brightness pushes tones lighter', () => {
    const a = flat(8, 128), b = flat(8, 128);
    dither(a, 8, GRAY, 0, 1); dither(b, 8, GRAY, 0.3, 1);
    expect(histogram(b, GRAY)[3]).toBeGreaterThan(histogram(a, GRAY)[3]);
  });

  it('works with a 2-color palette', () => {
    const pal = PALETTES.find(p => p.name === '1BIT').colors.map(hexToRgb);
    const d = flat(4, 128);
    dither(d, 4, pal);
    expect(histogram(d, pal)).toEqual([8, 8]);
  });
});
