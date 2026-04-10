// scan-left-desks.cjs — find bright horizontal surfaces on the LEFT side of the room
const sharp = require('sharp');

async function scan() {
  const { data, info } = await sharp('./src/assets/office-bg.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width, H = info.height, ch = info.channels;

  // The left side of the room. Scan x from 0.08 to 0.35, y from 0.40 to 0.75
  // Looking for brownish/warm pixels that indicate desk surfaces
  const candidates = [];
  for (let xi = 8; xi <= 35; xi += 1) {
    for (let yi = 42; yi <= 75; yi += 2) {
      const xp = xi / 100;
      const yp = yi / 100;
      const px = Math.round(xp * W);
      const py = Math.round(yp * H);
      const idx = (py * W + px) * ch;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      const bright = r + g + b;
      // Desk surfaces tend to be brownish/warm (r > b) and reasonably bright
      const isDeskLike = r > b && r > 60 && bright > 120 && bright < 500;
      if (isDeskLike) {
        candidates.push({ xp: xp.toFixed(2), yp: yp.toFixed(2), px, py, r, g, b, bright });
      }
    }
  }

  // Sort by x (leftmost first), show top candidates
  candidates.sort((a, b) => parseFloat(a.xp) - parseFloat(b.xp));
  console.log('=== DESK-LIKE surfaces on LEFT side of room ===');
  candidates.slice(0, 20).forEach(c => {
    console.log(`(${c.xp}, ${c.yp}) → pixel(${c.px},${c.py}) rgb(${c.r},${c.g},${c.b}) bright=${c.bright}`);
  });
}

scan().catch(e => console.error(e.message));
