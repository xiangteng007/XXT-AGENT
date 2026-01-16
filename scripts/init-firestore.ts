/**
 * Firestore Initialization Script
 * 
 * Run this script to initialize demo data in Firestore.
 * 
 * Usage:
 *   npx ts-node scripts/init-firestore.ts
 * 
 * Prerequisites:
 *   - Set GOOGLE_APPLICATION_CREDENTIALS environment variable
 *   - Or place serviceAccountKey.json in scripts/ folder
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

// Try to load service account
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
let credential;

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8')
    ) as ServiceAccount;
    credential = cert(serviceAccount);
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Use ADC
    credential = undefined;
} else {
    console.error('❌ No credentials found!');
    console.error('   Either:');
    console.error('   1. Place serviceAccountKey.json in scripts/ folder');
    console.error('   2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
    process.exit(1);
}

initializeApp({ credential });
const db = getFirestore();

interface InitConfig {
    teamName: string;
    teamSlug: string;
    lineChannelId: string;
    notionDatabaseId: string;
}

async function initializeFirestore(config: InitConfig): Promise<void> {
    console.log('🚀 Initializing Firestore...\n');

    const now = Timestamp.now();
    const teamId = config.teamSlug;
    const projectId = 'default-project';
    const integrationId = 'default';
    const notionIntegrationId = 'notion-default';

    try {
        // 1. Create Team
        console.log('📁 Creating team...');
        await db.collection('teams').doc(teamId).set({
            name: config.teamName,
            slug: config.teamSlug,
            createdAt: now,
            updatedAt: now,
            ownerId: 'admin',
            lineChannelId: config.lineChannelId,
            plan: 'free',
            settings: {
                replyEnabled: true,
                defaultTimezone: 'Asia/Taipei',
                replyMessages: {
                    success: '✅ 已成功寫入 Notion！',
                    failure: '❌ 寫入失敗，請稍後再試。',
                    noMatch: '⚠️ 找不到匹配的規則。請使用 #todo、#idea 等標籤。',
                },
            },
        });
        console.log(`   ✓ Team "${config.teamName}" created`);

        // 2. Create LINE Integration
        console.log('🔗 Creating LINE integration...');
        await db.collection('integrations').doc(integrationId).set({
            teamId,
            type: 'line',
            name: 'LINE Official Account',
            line: {
                channelId: config.lineChannelId,
            },
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });
        console.log('   ✓ LINE integration created');

        // 3. Create Notion Integration
        console.log('🔗 Creating Notion integration...');
        await db.collection('integrations').doc(notionIntegrationId).set({
            teamId,
            type: 'notion',
            name: 'Notion Workspace',
            notion: {
                workspaceId: 'default',
                workspaceName: 'Notion Workspace',
            },
            isActive: true,
            createdAt: now,
            updatedAt: now,
        });
        console.log('   ✓ Notion integration created');

        // 4. Create Project
        console.log('📋 Creating project...');
        await db
            .collection('teams')
            .doc(teamId)
            .collection('projects')
            .doc(projectId)
            .set({
                teamId,
                name: 'Default Project',
                description: 'Default project for LINE to Notion automation',
                createdAt: now,
                updatedAt: now,
                isActive: true,
                notionIntegrationId,
                defaultDatabaseId: config.notionDatabaseId,
            });
        console.log('   ✓ Project created');

        // 5. Create Rules
        console.log('📜 Creating rules...');

        const rules = [
            {
                id: 'todo-rule',
                name: 'Todo Rule',
                priority: 1,
                matcher: {
                    type: 'prefix',
                    pattern: '#todo',
                    caseSensitive: false,
                },
                action: {
                    fieldMapping: {
                        title: '訊息內容',
                        date: '建立時間',
                        status: '待處理',
                    },
                    removePattern: true,
                },
            },
            {
                id: 'idea-rule',
                name: 'Idea Rule',
                priority: 2,
                matcher: {
                    type: 'prefix',
                    pattern: '#idea',
                    caseSensitive: false,
                },
                action: {
                    fieldMapping: {
                        title: '訊息內容',
                        date: '建立時間',
                        tags: ['靈感'],
                    },
                    removePattern: true,
                },
            },
            {
                id: 'urgent-rule',
                name: 'Urgent Rule',
                priority: 3,
                matcher: {
                    type: 'keyword',
                    pattern: '#urgent',
                    caseSensitive: false,
                },
                action: {
                    fieldMapping: {
                        title: '訊息內容',
                        date: '建立時間',
                        status: '緊急',
                        tags: ['緊急'],
                    },
                    removePattern: true,
                },
            },
        ];

        for (const rule of rules) {
            await db
                .collection('teams')
                .doc(teamId)
                .collection('projects')
                .doc(projectId)
                .collection('rules')
                .doc(rule.id)
                .set({
                    ...rule,
                    projectId,
                    isActive: true,
                    action: {
                        ...rule.action,
                        databaseId: config.notionDatabaseId,
                    },
                    createdAt: now,
                    updatedAt: now,
                });
            console.log(`   ✓ Rule "${rule.name}" created`);
        }

        // 6. Create Admin Member
        console.log('👤 Creating admin member...');
        await db
            .collection('teams')
            .doc(teamId)
            .collection('members')
            .doc('admin')
            .set({
                userId: 'admin',
                email: 'admin@example.com',
                displayName: 'Admin',
                role: 'owner',
                permissions: {
                    canManageTeam: true,
                    canManageProjects: true,
                    canManageRules: true,
                    canViewLogs: true,
                },
                joinedAt: now,
            });
        console.log('   ✓ Admin member created');

        console.log('\n✅ Firestore initialization complete!');
        console.log('\n📝 Summary:');
        console.log(`   Team ID: ${teamId}`);
        console.log(`   Project ID: ${projectId}`);
        console.log(`   LINE Channel ID: ${config.lineChannelId}`);
        console.log(`   Notion Database ID: ${config.notionDatabaseId}`);
        console.log(`   Rules: ${rules.length} rules created`);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Configuration - Update these values!
const config: InitConfig = {
    teamName: 'Demo Team',
    teamSlug: 'demo-team',
    lineChannelId: 'YOUR_LINE_CHANNEL_ID',      // TODO: Replace
    notionDatabaseId: 'YOUR_NOTION_DATABASE_ID', // TODO: Replace
};

// Run initialization
initializeFirestore(config)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
