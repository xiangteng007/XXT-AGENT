/**
 * POST /api/admin/rules/test - Test rule matching
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken, canAccessTenant } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';

interface RuleMatch {
    type: 'prefix' | 'keyword' | 'contains' | 'regex';
    value: string;
    caseSensitive?: boolean;
}

function matchRule(text: string, match: RuleMatch): boolean {
    const pattern = match.value;
    const flags = match.caseSensitive ? '' : 'i';

    switch (match.type) {
        case 'prefix':
            if (match.caseSensitive) {
                return text.startsWith(pattern);
            }
            return text.toLowerCase().startsWith(pattern.toLowerCase());

        case 'keyword':
        case 'contains':
            if (match.caseSensitive) {
                return text.includes(pattern);
            }
            return text.toLowerCase().includes(pattern.toLowerCase());

        case 'regex':
            try {
                const regex = new RegExp(pattern, flags);
                return regex.test(text);
            } catch {
                return false;
            }

        default:
            return false;
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAuthToken(req);

    if (!auth.success || !auth.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { tenantId, text } = body;

        if (!tenantId || !text) {
            return NextResponse.json({ error: 'tenantId and text are required' }, { status: 400 });
        }

        if (!canAccessTenant(auth.user, tenantId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const db = getAdminDb();
        const rulesRef = db.collection('tenants').doc(tenantId).collection('rules');
        const snapshot = await rulesRef
            .where('enabled', '==', true)
            .orderBy('priority', 'desc')
            .get();

        const matches: Array<{
            ruleId: string;
            name: string;
            priority: number;
            match: RuleMatch;
            route: { databaseId: string; tags: string[] };
        }> = [];

        for (const doc of snapshot.docs) {
            const rule = doc.data();
            if (matchRule(text, rule.match)) {
                matches.push({
                    ruleId: doc.id,
                    name: rule.name,
                    priority: rule.priority,
                    match: rule.match,
                    route: rule.route,
                });
            }
        }

        return NextResponse.json({
            text,
            matchCount: matches.length,
            matches,
            bestMatch: matches.length > 0 ? matches[0] : null,
        });

    } catch (error) {
        console.error('Test rule error:', error);
        return NextResponse.json({ error: 'Failed to test rules' }, { status: 500 });
    }
}
