/**
 * Deterministic poster-style artwork generator.
 *
 * The catalog ships without licensed photography, so every profile gets a
 * generated editorial portrait poster instead. Output is stable for a given
 * (seed, variant) pair so re-running the seed script does not churn files.
 */
import sharp from "sharp";

const W = 800;
const H = 1000;

export type Palette = {
  name: string;
  bg: [string, string];
  blobs: [string, string, string];
  figure: string;
  accent: string;
};

export const PALETTES: Palette[] = [
  { name: "ember", bg: ["#1a0a14", "#3d0f2a"], blobs: ["#ff3d7f", "#ff8a5b", "#7b2ff7"], figure: "#ffd9e6", accent: "#ff3d7f" },
  { name: "midnight", bg: ["#080b1d", "#161a45"], blobs: ["#5b6bff", "#00d4ff", "#a855f7"], figure: "#dbe4ff", accent: "#6c7dff" },
  { name: "sable", bg: ["#140f0b", "#3a2416"], blobs: ["#ff9f43", "#ffd166", "#e0554b"], figure: "#ffeccf", accent: "#ffa94d" },
  { name: "jade", bg: ["#04140f", "#0d3b2e"], blobs: ["#22d3a5", "#7dffce", "#0ea5e9"], figure: "#d6fff0", accent: "#25e0ab" },
  { name: "orchid", bg: ["#150a1e", "#3b1256"], blobs: ["#c084fc", "#f472b6", "#818cf8"], figure: "#f3e0ff", accent: "#c77dff" },
  { name: "rouge", bg: ["#180509", "#4a0d1c"], blobs: ["#f43f5e", "#fb7185", "#facc15"], figure: "#ffe1e6", accent: "#fb3b5c" },
  { name: "azure", bg: ["#05101c", "#0b2f4a"], blobs: ["#38bdf8", "#22d3ee", "#6366f1"], figure: "#d8f1ff", accent: "#38bdf8" },
  { name: "dune", bg: ["#12100c", "#3a3324"], blobs: ["#eab308", "#f59e0b", "#a3e635"], figure: "#fbf3d5", accent: "#e3b341" },
  { name: "plum", bg: ["#100713", "#2f0f3d"], blobs: ["#a21caf", "#e879f9", "#6366f1"], figure: "#f6dcff", accent: "#d946ef" },
  { name: "cocoa", bg: ["#120c0a", "#3b241f"], blobs: ["#f97316", "#fb923c", "#ec4899"], figure: "#ffe6d5", accent: "#fb8c3c" },
  { name: "arctic", bg: ["#0a0f14", "#1e2f3d"], blobs: ["#94a3b8", "#67e8f9", "#c4b5fd"], figure: "#e8f4ff", accent: "#8fd3ff" },
  { name: "velvet", bg: ["#0d0713", "#2a1040"], blobs: ["#7c3aed", "#ec4899", "#f97316"], figure: "#efe0ff", accent: "#a855f7" },
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function backgroundSvg(palette: Palette, rand: () => number) {
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const color = palette.blobs[i % palette.blobs.length];
    const cx = Math.round(rand() * W);
    const cy = Math.round(rand() * H);
    const r = Math.round(180 + rand() * 260);
    const opacity = (0.35 + rand() * 0.45).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" />`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${palette.bg[0]}" />
        <stop offset="100%" stop-color="${palette.bg[1]}" />
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)" />
    ${blobs}
  </svg>`;
}

/**
 * Flat paper-cut bust: hair mass, two falling strands, neck and shoulders.
 * All shapes share one fill so they merge into a single silhouette outline.
 */
function figureShapes(color: string, opacity: number) {
  return `<g fill="${color}" opacity="${opacity}">
      <path d="M28 1060 L28 800 C28 700 88 634 190 602
               C270 576 340 538 400 538 C460 538 530 576 610 602
               C712 634 772 700 772 800 L772 1060 Z" />
      <rect x="354" y="368" width="92" height="180" rx="30" />
      <path d="M400 158 C310 158 284 230 288 306
               C290 362 284 414 278 456 C275 480 308 488 316 464
               C328 428 334 392 336 362 L464 362
               C466 392 472 428 484 464 C492 488 525 480 522 456
               C516 414 510 362 512 306 C516 230 490 158 400 158 Z" />
      <ellipse cx="400" cy="300" rx="100" ry="124" />
    </g>`;
}

/**
 * Backlit bust: a dark paper-cut silhouette with a soft rim light behind it,
 * cropped like a studio portrait so the shoulders fill the bottom of the frame.
 */
function figureGroup(scale: number, dx: number, dy: number, rim: string, opacity: number, flip = false) {
  const transform = `translate(${400 + dx} ${620 + dy}) scale(${flip ? -scale : scale} ${scale}) translate(-400 -620)`;
  return `<g transform="${transform}">
      <g transform="translate(400 620) scale(1.045) translate(-400 -620) translate(-20 -16)">${figureShapes(
        rim,
        opacity * 0.5,
      )}</g>
      ${figureShapes("#08040c", opacity * 0.92)}
    </g>`;
}

function foregroundSvg(opts: {
  palette: Palette;
  variant: number;
  label: string;
  monogram: string;
  rand: () => number;
}) {
  const { palette, variant, label, monogram, rand } = opts;
  const figure = palette.figure;

  let composition = "";
  if (variant === 0) {
    composition = `
      <circle cx="400" cy="392" r="292" fill="none" stroke="${figure}" stroke-opacity="0.16" stroke-width="2" />
      ${figureGroup(1, 0, 0, figure, 0.92)}`;
  } else if (variant === 1) {
    composition = `
      <circle cx="400" cy="360" r="330" fill="${palette.accent}" opacity="0.16" />
      ${figureGroup(1.42, 0, 150, figure, 0.94)}`;
  } else if (variant === 2) {
    composition = `
      <circle cx="250" cy="300" r="158" fill="${palette.accent}" opacity="0.32" />
      ${figureGroup(1.12, 120, 60, figure, 0.9, true)}`;
  } else {
    const rings = Array.from({ length: 6 }, (_, i) => {
      const r = 90 + i * 62;
      return `<circle cx="400" cy="500" r="${r}" fill="none" stroke="${figure}" stroke-opacity="${(
        0.3 -
        i * 0.035
      ).toFixed(3)}" stroke-width="1.5" />`;
    }).join("");
    composition = `${rings}
      <text x="470" y="700" text-anchor="middle" font-family="Georgia, serif" font-size="300"
            fill="${figure}" opacity="0.2">${monogram}</text>
      ${figureGroup(0.88, -130, 120, figure, 0.9)}`;
  }

  const speckles = Array.from({ length: 26 }, () => {
    const cx = Math.round(rand() * W);
    const cy = Math.round(rand() * H);
    const r = (rand() * 2.2 + 0.6).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="${(rand() * 0.28).toFixed(2)}" />`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <radialGradient id="vig" cx="50%" cy="42%" r="78%">
        <stop offset="55%" stop-color="#000000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.62" />
      </radialGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.72" />
      </linearGradient>
    </defs>
    ${composition}
    ${speckles}
    <rect width="${W}" height="${H}" fill="url(#vig)" />
    <rect y="${H - 320}" width="${W}" height="320" fill="url(#floor)" />
    <rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="#ffffff" stroke-opacity="0.16" />
    <text x="58" y="${H - 58}" font-family="Helvetica, Arial, sans-serif" font-size="26" letter-spacing="9"
          fill="#ffffff" fill-opacity="0.82">${label.toUpperCase()}</text>
    <text x="${W - 58}" y="88" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="20"
          letter-spacing="6" fill="#ffffff" fill-opacity="0.5">AUREA</text>
  </svg>`;
}

async function grainOverlay(rand: () => number) {
  const pixels = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i += 1) {
    const value = Math.round(rand() * 255);
    pixels[i * 4] = value;
    pixels[i * 4 + 1] = value;
    pixels[i * 4 + 2] = value;
    pixels[i * 4 + 3] = 16;
  }
  return sharp(pixels, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
}

export async function renderPoster(opts: {
  seed: string;
  variant: number;
  palette: Palette;
  label: string;
  monogram: string;
  outFile: string;
}) {
  const rand = mulberry32(hashString(`${opts.seed}:${opts.variant}`));
  const background = await sharp(Buffer.from(backgroundSvg(opts.palette, rand)))
    .blur(70)
    .modulate({ saturation: 1.12 })
    .toBuffer();

  const foreground = Buffer.from(
    foregroundSvg({ palette: opts.palette, variant: opts.variant, label: opts.label, monogram: opts.monogram, rand }),
  );
  const grain = await grainOverlay(rand);

  await sharp(background)
    .composite([{ input: foreground }, { input: grain, blend: "overlay" }])
    .webp({ quality: 82 })
    .toFile(opts.outFile);
}
