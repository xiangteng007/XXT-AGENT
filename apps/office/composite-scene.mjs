/**
 * composite-scene.mjs  v4 — 精細融合版
 *
 * 策略：
 *   1. 每個角色圖縮小到合理比例（相對於背景）
 *   2. 用橢圓 mask 做邊緣羽化，但 center opacity = 1, edge = 0
 *      - 關鍵：fx/fy 用較大值（0.60-0.70）確保角色主體仍清晰可見
 *      - 羽化主要發生在最外邊緣 10-15% 
 *   3. 色調微調：調暗外圍、加強對比
 *
 * Run:  node composite-scene.mjs
 */

import sharp from 'sharp';
import path  from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dir, 'src', 'assets');

const BG_PATH  = path.join(ASSETS, 'office-bg.png');
const OUT_PATH = path.join(ASSETS, 'office-scene.png');

const bgMeta = await sharp(BG_PATH).metadata();
const BG_W = bgMeta.width;
const BG_H = bgMeta.height;
console.log(`Background: ${BG_W} x ${BG_H}`);

const W = BG_W;
const H = BG_H;

// ── Character placements ─────────────────────────────────────────────
// size: character height in px
// fx, fy: fade ellipse radius as fraction (0.6 = fades start at 60% from centre)
const chars = [
  // id,                  file,                        xPct,  yPct,  size,  fx,    fy
  // Nick Fury — centre-back command desk, slightly larger as the director
  ['director',         'char-director.png',            0.51,  0.41,  162,   0.58,  0.56],
  // Spider-Man — left workstation near arcade
  ['pixidev',          'char-pixidev.png',             0.20,  0.64,  138,   0.55,  0.53],
  // Dr. Strange — right bookshelf area, slightly right-of-centre
  ['architect',        'char-architect.png',           0.82,  0.49,  132,   0.55,  0.53],
  // Quicksilver — centre floor, small because it's in open space
  ['flashbot',         'char-flashbot.png',            0.43,  0.66,  128,   0.55,  0.54],
  // Black Widow — far left arcade corner
  ['scribe',           'char-scribe.png',              0.10,  0.56,  130,   0.52,  0.51],
  // Iron Man — right monitor station, tighter crop to reduce blue halo
  ['market-analyst',   'char-market-analyst.png',      0.73,  0.58,  135,   0.38,  0.36],
  // Cap. America — front-right desk, tighter crop to reduce blue halo
  ['risk-manager',     'char-risk-manager.png',        0.61,  0.65,  132,   0.35,  0.33],
  // Black Panther — centre-left, lighten significantly so visible on dark bg
  ['strategy-planner', 'char-strategy-planner.png',   0.375,  0.56,  140,   0.58,  0.56],
];

// ── Build alpha mask: white in centre, fades to transparent at edges ──
async function makeAlphaMask(w, h, fx, fy) {
  // Radial gradient: fully opaque at center, fades out toward corners
  // fx, fy control where the fade STARTS (as % of half-dimension)
  // The SVG gradient goes: 100% opacity → fade → 0% at r=1
  // We scale so the "start of fade" is at fx*w, fy*h from centre

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
      <stop offset="0%"        stop-color="white" stop-opacity="1"/>
      <stop offset="${Math.round(fx*100)}%" stop-color="white" stop-opacity="1"/>
      <stop offset="${Math.round(fx*100 + (100-fx*100)*0.4)}%" stop-color="white" stop-opacity="0.7"/>
      <stop offset="${Math.round(fx*100 + (100-fx*100)*0.75)}%" stop-color="white" stop-opacity="0.25"/>
      <stop offset="100%"      stop-color="white" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" fill="url(#g)"/>
</svg>`;

  const { data, info } = await sharp(Buffer.from(svg))
    .resize(w, h)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height };
}

// ── Prepare character: resize + colorgrade + alpha-mask edges ─────────
async function prepareChar(file, size, fx, fy) {
  const src = path.join(ASSETS, file);

  // 1. Resize
  const resized = await sharp(src)
    .resize({ height: size, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();

  const rMeta = await sharp(resized).metadata();
  const CW = rMeta.width;
  const CH = rMeta.height;

  // 2. Per-character colour grade
  const isStrategyPlanner = file.includes('strategy-planner');
  // Black panther is very dark — boost brightness significantly
  // Other dark-bg chars: keep slightly dark to blend with neon bg
  let bri = isStrategyPlanner ? 1.35 : 0.86;
  let sat = isStrategyPlanner ? 0.90 : 1.10;
  const graded = await sharp(resized)
    .modulate({ brightness: bri, saturation: sat, hue: -5 })
    .toBuffer();

  // 3. Get RGBA pixels
  const { data: rgbaData } = await sharp(graded)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 4. Create mask
  const { data: maskData } = await makeAlphaMask(CW, CH, fx, fy);

  // 5. Multiply alpha channels
  const pixels = CW * CH;
  for (let i = 0; i < pixels; i++) {
    const orig = rgbaData[i * 4 + 3];
    const mask = maskData[i];
    rgbaData[i * 4 + 3] = Math.round(orig * mask / 255);
  }

  // 6. Re-encode
  const finalBuf = await sharp(Buffer.from(rgbaData), {
    raw: { width: CW, height: CH, channels: 4 }
  }).png().toBuffer();

  return { data: finalBuf, width: CW, height: CH };
}

// ── Build composite list ─────────────────────────────────────────────
const composites = [];

for (const [id, file, xPct, yPct, size, fx, fy] of chars) {
  const { data, width, height } = await prepareChar(file, size, fx, fy);

  const left = Math.round(xPct * W - width / 2);
  const top  = Math.round(yPct * H - height);

  composites.push({
    input: data,
    left: Math.max(0, left),
    top:  Math.max(0, top),
    blend: 'over',
  });

  console.log(`  ${id}: pos(${left},${top}) size(${width}x${height})`);
}

// ── Composite ────────────────────────────────────────────────────────
await sharp(BG_PATH)
  .composite(composites)
  .toFile(OUT_PATH);

console.log(`\n✓ Saved → ${OUT_PATH}`);
