/**
 * Convert PNG to optimized JPEG for LINE Rich Menu
 */

import sharp from 'sharp';
import * as path from 'path';

const inputPath = process.argv[2] || 'rich-menu-image.png';
const outputPath = path.join(path.dirname(inputPath), 'rich-menu-image.jpg');

async function convert() {
    console.log(`Converting ${inputPath} to JPEG...`);
    
    await sharp(inputPath)
        .resize(2500, 1686, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(outputPath);
    
    const stats = require('fs').statSync(outputPath);
    console.log(`Created ${outputPath} (${Math.round(stats.size / 1024)} KB)`);
}

convert().catch(console.error);
