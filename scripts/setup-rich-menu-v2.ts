/**
 * Compress and upload rich menu image
 * Converts PNG to JPEG with compression for LINE API upload
 */

import * as fs from 'fs';
import * as https from 'https';

const CHANNEL_ACCESS_TOKEN = '/VnoczueCOD+OBZj7l5m3lsQBk50/whhQRa/jerM/P4aQPgzDoW0zqDqfYiyl076mIbxFef58FmbGWLVBYbCRFjb9XjdLNHwjAFiYdn8q+7i7ImVxoOwrYXl0WsMxe3rjePuozaGdmSVU3COICF5CAdB04t89/1O/w1cDnyilFU=';

// Rich Menu Configuration - 2500x1686 layout with 6 buttons (3x2 grid)
const RICH_MENU_CONFIG = {
    size: {
        width: 2500,
        height: 1686
    },
    selected: true,
    name: '小秘書主選單',
    chatBarText: '開啟選單',
    areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: 'message', text: '今天行程' } },
        { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: 'message', text: '這個月支出' } },
        { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: 'message', text: '保養提醒' } },
        { bounds: { x: 0, y: 843, width: 833, height: 843 }, action: { type: 'message', text: '今日健康' } },
        { bounds: { x: 833, y: 843, width: 834, height: 843 }, action: { type: 'message', text: '專案狀態' } },
        { bounds: { x: 1667, y: 843, width: 833, height: 843 }, action: { type: 'message', text: '幫助' } }
    ]
};

async function apiRequest(method: string, path: string, body?: Buffer | object, contentType?: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const isDataApi = path.includes('/content');
        const hostname = isDataApi ? 'api-data.line.me' : 'api.line.me';
        
        const options = {
            hostname,
            path,
            method,
            headers: {
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
                ...(contentType ? { 'Content-Type': contentType } : {}),
                ...(body && !Buffer.isBuffer(body) ? { 'Content-Type': 'application/json' } : {})
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data ? JSON.parse(data) : {});
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        
        if (body) {
            if (Buffer.isBuffer(body)) {
                req.write(body);
            } else {
                req.write(JSON.stringify(body));
            }
        }
        req.end();
    });
}

async function main() {
    console.log('🚀 LINE Rich Menu Setup with Native HTTPS\n');

    try {
        // List existing menus
        console.log('📋 Checking existing rich menus...');
        const listResult = await apiRequest('GET', '/v2/bot/richmenu/list');
        console.log(`Found ${listResult.richmenus?.length || 0} existing rich menus`);
        
        // Delete all existing menus
        for (const menu of listResult.richmenus || []) {
            console.log(`🗑️ Deleting ${menu.richMenuId}...`);
            try {
                await apiRequest('DELETE', `/v2/bot/richmenu/${menu.richMenuId}`);
                console.log('   ✅ Deleted');
            } catch (e) {
                console.log(`   ⚠️ Failed to delete: ${e}`);
            }
        }

        // Create new rich menu
        console.log('\n📋 Creating new rich menu...');
        const createResult = await apiRequest('POST', '/v2/bot/richmenu', RICH_MENU_CONFIG);
        const richMenuId = createResult.richMenuId;
        console.log(`✅ Created: ${richMenuId}`);

        // Upload image
        const imagePath = process.argv[2] || 'rich-menu-image.png';
        if (!fs.existsSync(imagePath)) {
            throw new Error(`Image not found: ${imagePath}`);
        }
        
        const imageBuffer = fs.readFileSync(imagePath);
        const fileSizeKB = Math.round(imageBuffer.length / 1024);
        console.log(`\n📤 Uploading image (${fileSizeKB} KB)...`);
        
        if (imageBuffer.length > 1024 * 1024) {
            console.error('❌ Image too large! Must be under 1MB.');
            console.log('Tip: Convert to JPEG or reduce quality.');
            process.exit(1);
        }
        
        const contentType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
        await apiRequest('POST', `/v2/bot/richmenu/${richMenuId}/content`, imageBuffer, contentType);
        console.log('✅ Image uploaded');

        // Set as default
        console.log('\n🎯 Setting as default menu...');
        await apiRequest('POST', `/v2/bot/user/all/richmenu/${richMenuId}`);
        console.log('✅ Default menu set');

        console.log('\n🎉 Rich menu setup complete!');
        console.log(`   Menu ID: ${richMenuId}`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
