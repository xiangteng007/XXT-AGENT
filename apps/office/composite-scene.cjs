// composite-scene.cjs  — CommonJS to avoid ESM issues
const sharp = require('sharp');
const path  = require('path');

const ASSETS = path.join(__dirname, 'src', 'assets');
const BG_PATH = path.join(ASSETS, 'office-bg.png');
const OUT_PATH = path.join(ASSETS, 'office-scene.png');

async function run() {
  const bgMeta = await sharp(BG_PATH).metadata();
  const W = bgMeta.width;
  const H = bgMeta.height;
  console.log(`Background: ${W} x ${H}`);

  // xPct, yPct = bottom-centre of character as fraction of image
  // size = character height in px
  const chars = [
    ['director',          'char-director.png',          0.51, 0.43, 148],  // centre-back command desk
    ['pixidev',           'char-pixidev.png',           0.22, 0.63, 142],  // left L-desk
    ['architect',         'char-architect.png',         0.85, 0.49, 135],  // right bookshelf
    ['flashbot',          'char-flashbot.png',          0.38, 0.58, 120],  // centre-left desk
    // Black Widow → Arcade machine corner desk area (warm pixel at 0.14,0.50 confirms desk surface)
    ['scribe',            'char-scribe.png',            0.15, 0.53, 128],
    ['market-analyst',    'char-market-analyst.png',    0.76, 0.49, 142],  // right trading-hub
    ['risk-manager',      'char-risk-manager.png',      0.62, 0.62, 140],  // front-right desk
    ['strategy-planner',  'char-strategy-planner.png',  0.68, 0.56, 132],  // centre-right desk
  ];

  const composites = [];

  for (const [id, file, xPct, yPct, size] of chars) {
    const src = path.join(ASSETS, file);
    const { data, info } = await sharp(src)
      .resize({ height: size, fit: 'inside', withoutEnlargement: false })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const left = Math.max(0, Math.round(xPct * W - info.width / 2));
    const top  = Math.max(0, Math.round(yPct * H - info.height));

    console.log(`  ${id}: pos(${left},${top}) size(${info.width}x${info.height})`);

    composites.push({
      input: data,
      raw: { width: info.width, height: info.height, channels: info.channels },
      left,
      top,
    });
  }

  await sharp(BG_PATH)
    .composite(composites)
    .toFile(OUT_PATH);

  console.log(`\n✓ Saved → ${OUT_PATH}`);
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
