import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.join(__dirname, 'src', 'assets');

const chars = [
  'char-director.png', 'char-pixidev.png', 'char-architect.png', 
  'char-flashbot.png', 'char-scribe.png', 'char-market-analyst.png', 
  'char-risk-manager.png', 'char-strategy-planner.png'
];

async function removeBlackBackgrounds() {
  for (const file of chars) {
    const filePath = path.join(assetsDir, file);
    if (!fs.existsSync(filePath)) continue;

    console.log(`Processing ${file}...`);
    try {
      const { data: buf, info } = await sharp(filePath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      for (let i = 0; i < buf.length; i += 4) {
        const r = buf[i], g = buf[i+1], b = buf[i+2];
        const maxBrightness = Math.max(r, g, b);
        
        // If the pixel is very dark (<= 15), make it transparent
        if (maxBrightness <= 15) {
          if (maxBrightness < 8) {
            buf[i+3] = 0; // fully transparent
          } else {
            // antialiasing / soft edge for near-black pixels
            buf[i+3] = Math.floor(((maxBrightness - 8) / 7) * 255);
          }
        }
      }

      await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toFile(path.join(assetsDir, `tp-${file}`));
        
      fs.copyFileSync(path.join(assetsDir, `tp-${file}`), filePath);
      fs.unlinkSync(path.join(assetsDir, `tp-${file}`));
      console.log(`   Done: ${file}`);
    } catch (err) {
      console.error(`Failed on ${file}`, err);
    }
  }
}

removeBlackBackgrounds();
