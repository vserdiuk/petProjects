// Game Boy Camera-style ordered dithering, pure functions (no DOM).

export const PALETTES = [
  { name: 'GB',   colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { name: 'GRAY', colors: ['#000000', '#555555', '#aaaaaa', '#ffffff'] },
  { name: 'ROSE', colors: ['#2b0f1e', '#7a2a4a', '#d77a9a', '#f6e3ea'] },
  { name: '1BIT', colors: ['#000000', '#ffffff'] },
];

// 4×4 Bayer matrix → thresholds in 0..1
export const BAYER = [0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5].map(v => (v + 0.5) / 16);

export const hexToRgb = h => [1, 3, 5].map(o => parseInt(h.slice(o, o + 2), 16));

/**
 * Dither RGBA pixels in place to the given palette (dark → light).
 * @param {Uint8ClampedArray} d  RGBA data, width × width
 * @param {number} N             width in pixels
 * @param {number[][]} pal       palette as [r,g,b] arrays
 * @param {number} bright        -0.5..0.5
 * @param {number} contrast      0.5..2.5
 */
export function dither(d, N, pal, bright = 0, contrast = 1) {
  const L = pal.length - 1;
  for (let y = 0, i = 0; i < d.length; y++) {
    const row = (y & 3) << 2;
    for (let x = 0; x < N; x++, i += 4) {
      let v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      v = (v - 0.5) * contrast + 0.5 + bright;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      const s = v * L, k0 = s | 0;
      const k = Math.min(L, k0 + (s - k0 > BAYER[row | (x & 3)] ? 1 : 0));
      const p = pal[k];
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = 255;
    }
  }
}
