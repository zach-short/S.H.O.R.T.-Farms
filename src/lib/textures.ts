/**
 * Procedurally generated surface textures, drawn once to a canvas and cached
 * as data URLs.
 *
 * Generating them beats shipping image files: they are seamless by
 * construction, weigh nothing in the bundle, and can be retuned by changing a
 * number rather than re-exporting art. A real photographic texture can still
 * be dropped in later — see `surface.url` in `featureCatalog.ts`.
 */

export type TextureId = 'water' | 'gravel' | 'asphalt' | 'soil' | 'grass';

const SIZE = 256;
const cache = new Map<TextureId, string>();

/**
 * Seamless value noise: a small random lattice sampled with wrap-around, so
 * the result tiles cleanly on both axes.
 */
function valueNoise(cells: number, seed: number): Float32Array {
  const grid = new Float32Array(cells * cells);
  let state = seed >>> 0;
  const random = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < grid.length; i++) grid[i] = random();

  const at = (x: number, y: number) =>
    grid[(((y % cells) + cells) % cells) * cells + (((x % cells) + cells) % cells)];

  const out = new Float32Array(SIZE * SIZE);
  const scale = cells / SIZE;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const fx = x * scale;
      const fy = y * scale;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      // Smoothstep so the lattice does not show as a diamond grid.
      const sx = tx * tx * (3 - 2 * tx);
      const sy = ty * ty * (3 - 2 * ty);
      out[y * SIZE + x] =
        at(x0, y0) * (1 - sx) * (1 - sy) +
        at(x0 + 1, y0) * sx * (1 - sy) +
        at(x0, y0 + 1) * (1 - sx) * sy +
        at(x0 + 1, y0 + 1) * sx * sy;
    }
  }
  return out;
}

/** Fractal sum of noise octaves — the usual way to get natural-looking grain. */
function fbm(octaves: [cells: number, weight: number][], seed: number): Float32Array {
  const out = new Float32Array(SIZE * SIZE);
  let total = 0;
  octaves.forEach(([cells, weight], index) => {
    const layer = valueNoise(cells, seed + index * 7919);
    for (let i = 0; i < out.length; i++) out[i] += layer[i] * weight;
    total += weight;
  });
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

type Shader = (noise: number, x: number, y: number) => [number, number, number];

function render(shader: Shader, noise: Float32Array): string {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const image = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const [r, g, b] = shader(noise[i], x / SIZE, y / SIZE);
      image.data[i * 4] = clamp255(r);
      image.data[i * 4 + 1] = clamp255(g);
      image.data[i * 4 + 2] = clamp255(b);
      image.data[i * 4 + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

const TAU = Math.PI * 2;

const builders: Record<TextureId, () => string> = {
  // Ripples: banded waves broken up by noise, so it reads as moving water
  // rather than a flat blue fill.
  water: () => {
    const noise = fbm(
      [
        [4, 1],
        [8, 0.55],
        [16, 0.25],
      ],
      1337,
    );
    return render((n, x, y) => {
      // Fewer, higher-contrast waves. Fine ripples average to flat blue once
      // the texture is minified at parcel altitude, so the pattern has to be
      // coarse and strongly lit to read from a distance.
      const ripple = Math.sin((y * 4.5 + n * 1.8) * TAU) * 0.5 + 0.5;
      const cross = Math.sin((x * 2.5 - n * 1.2) * TAU) * 0.5 + 0.5;
      const swell = ripple * 0.6 + cross * 0.25 + n * 0.15;
      // Sharpened crests give a specular glint that survives downsampling.
      const crest = Math.pow(swell, 3.2);
      return [
        10 + swell * 34 + crest * 120,
        58 + swell * 92 + crest * 120,
        96 + swell * 116 + crest * 96,
      ];
    }, noise);
  },

  // Farm track: pale compacted stone with scattered darker aggregate.
  gravel: () => {
    const noise = fbm(
      [
        [16, 1],
        [32, 0.7],
        [64, 0.45],
      ],
      99,
    );
    return render((n) => {
      const grit = n > 0.62 ? 1.18 : n < 0.36 ? 0.82 : 1;
      const base = 132 + n * 74;
      return [base * grit, (base - 8) * grit, (base - 22) * grit];
    }, noise);
  },

  // Runway asphalt: dark, fine-grained, with faint lengthwise wear.
  asphalt: () => {
    const noise = fbm(
      [
        [24, 1],
        [48, 0.6],
        [96, 0.4],
      ],
      4242,
    );
    return render((n, _x, y) => {
      const wear = Math.sin(y * 3 * TAU) * 0.04;
      const base = 54 + n * 34 + wear * 255 * 0.12;
      return [base, base + 2, base + 6];
    }, noise);
  },

  // Worked ground: brown tilth with furrows running along the bed.
  soil: () => {
    const noise = fbm(
      [
        [12, 1],
        [24, 0.6],
        [48, 0.35],
      ],
      777,
    );
    return render((n, _x, y) => {
      const furrow = Math.sin(y * 14 * TAU) * 0.5 + 0.5;
      const shade = n * 0.6 + furrow * 0.4;
      return [78 + shade * 74, 56 + shade * 56, 38 + shade * 34];
    }, noise);
  },

  grass: () => {
    const noise = fbm(
      [
        [16, 1],
        [32, 0.7],
        [64, 0.4],
      ],
      2024,
    );
    return render((n) => [42 + n * 58, 84 + n * 86, 36 + n * 44], noise);
  },
};

/** Data URL for a texture, generated on first use. */
export function texture(id: TextureId): string {
  const cached = cache.get(id);
  if (cached) return cached;
  const url = builders[id]();
  cache.set(id, url);
  return url;
}
