/**
 * LINE Rich Menu Setup Script
 * 
 * Creates and configures the rich menu for 小秘書 (Personal Butler) bot.
 * 
 * Usage: npx ts-node setup-rich-menu.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CHANNEL_ACCESS_TOKEN = '/VnoczueCOD+OBZj7l5m3lsQBk50/whhQRa/jerM/P4aQPgzDoW0zqDqfYiyl076mIbxFef58FmbGWLVBYbCRFjb9XjdLNHwjAFiYdn8q+7i7ImVxoOwrYXl0WsMxe3rjePuozaGdmSVU3COICF5CAdB04t89/1O/w1cDnyilFU=';
const LINE_API_BASE = 'https://api.line.me/v2/bot';
const LINE_DATA_API_BASE = 'https://api-data.line.me/v2/bot';

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
        // Row 1
        {
            bounds: { x: 0, y: 0, width: 833, height: 843 },
            action: { type: 'message', text: '今天行程' }
        },
        {
            bounds: { x: 833, y: 0, width: 834, height: 843 },
            action: { type: 'message', text: '這個月支出' }
        },
        {
            bounds: { x: 1667, y: 0, width: 833, height: 843 },
            action: { type: 'message', text: '保養提醒' }
        },
        // Row 2
        {
            bounds: { x: 0, y: 843, width: 833, height: 843 },
            action: { type: 'message', text: '今日健康' }
        },
        {
            bounds: { x: 833, y: 843, width: 834, height: 843 },
            action: { type: 'message', text: '專案狀態' }
        },
        {
            bounds: { x: 1667, y: 843, width: 833, height: 843 },
            action: { type: 'message', text: '幫助' }
        }
    ]
};

// ================================
// API Functions
// ================================

async function createRichMenu(): Promise<string> {
    console.log('📋 Creating rich menu...');
    
    const response = await fetch(`${LINE_API_BASE}/richmenu`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify(RICH_MENU_CONFIG)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create rich menu: ${error}`);
    }

    const result = await response.json() as { richMenuId: string };
    console.log(`✅ Rich menu created: ${result.richMenuId}`);
    return result.richMenuId;
}

async function uploadRichMenuImage(richMenuId: string, imagePath: string): Promise<void> {
    console.log(`📤 Uploading image for ${richMenuId}...`);
    
    const imageBuffer = fs.readFileSync(imagePath);
    const contentType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    const response = await fetch(`${LINE_DATA_API_BASE}/richmenu/${richMenuId}/content`, {
        method: 'POST',
        headers: {
            'Content-Type': contentType,
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        },
        body: imageBuffer
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to upload image: ${error}`);
    }

    console.log('✅ Image uploaded successfully');
}

async function setDefaultRichMenu(richMenuId: string): Promise<void> {
    console.log(`🎯 Setting ${richMenuId} as default...`);
    
    const response = await fetch(`${LINE_API_BASE}/user/all/richmenu/${richMenuId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to set default rich menu: ${error}`);
    }

    console.log('✅ Default rich menu set successfully');
}

async function listRichMenus(): Promise<void> {
    console.log('📋 Listing existing rich menus...');
    
    const response = await fetch(`${LINE_API_BASE}/richmenu/list`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to list rich menus: ${error}`);
    }

    const result = await response.json() as { richmenus: Array<{ richMenuId: string; name: string }> };
    console.log('Existing rich menus:', result.richmenus.map(m => `${m.richMenuId} (${m.name})`).join(', ') || 'None');
}

async function deleteRichMenu(richMenuId: string): Promise<void> {
    console.log(`🗑️ Deleting rich menu ${richMenuId}...`);
    
    const response = await fetch(`${LINE_API_BASE}/richmenu/${richMenuId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        }
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to delete rich menu: ${error}`);
    }

    console.log('✅ Rich menu deleted');
}

// ================================
// Main Script
// ================================

async function main(): Promise<void> {
    console.log('🚀 LINE Rich Menu Setup for 小秘書\n');
    
    const args = process.argv.slice(2);
    const command = args[0] || 'setup';
    
    try {
        switch (command) {
            case 'list':
                await listRichMenus();
                break;
                
            case 'delete':
                if (!args[1]) {
                    console.error('Usage: npx ts-node setup-rich-menu.ts delete <richMenuId>');
                    process.exit(1);
                }
                await deleteRichMenu(args[1]);
                break;
                
            case 'setup':
            default:
                // Check for image file
                const imagePath = args[1] || path.join(__dirname, 'rich-menu-image.png');
                if (!fs.existsSync(imagePath)) {
                    console.error(`❌ Image not found: ${imagePath}`);
                    console.error('Please provide the rich menu image path as argument.');
                    console.error('Usage: npx ts-node setup-rich-menu.ts setup <imagePath>');
                    process.exit(1);
                }
                
                // List existing menus
                await listRichMenus();
                
                // Create new rich menu
                const richMenuId = await createRichMenu();
                
                // Upload image
                await uploadRichMenuImage(richMenuId, imagePath);
                
                // Set as default
                await setDefaultRichMenu(richMenuId);
                
                console.log('\n🎉 Rich menu setup complete!');
                console.log(`   Menu ID: ${richMenuId}`);
                console.log('   Open LINE app to verify the menu.');
                break;
        }
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
