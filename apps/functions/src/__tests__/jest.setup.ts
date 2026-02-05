/**
 * Jest Setup - Global Mocks
 * 
 * This file runs before all tests to set up global mocks for Firebase and other services.
 */

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    apps: [],
    auth: jest.fn(() => ({
        verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-user-id' }),
        getUser: jest.fn().mockResolvedValue({ uid: 'test-user-id', email: 'test@example.com' }),
    })),
    firestore: jest.fn(() => ({
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
    })),
}));

// Mock Firebase Admin Firestore
jest.mock('firebase-admin/firestore', () => ({
    getFirestore: jest.fn(() => ({
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ exists: false, data: () => null, docs: [] }),
        set: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        runTransaction: jest.fn().mockImplementation((fn) => fn({
            get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        })),
        batch: jest.fn(() => ({
            set: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            delete: jest.fn().mockReturnThis(),
            commit: jest.fn().mockResolvedValue(undefined),
        })),
    })),
    Timestamp: {
        now: jest.fn(() => ({ toMillis: () => Date.now() })),
        fromMillis: jest.fn((ms) => ({ toMillis: () => ms })),
        fromDate: jest.fn((date) => ({ toDate: () => date, toMillis: () => date.getTime() })),
    },
    FieldValue: {
        serverTimestamp: jest.fn(() => ({ _type: 'serverTimestamp' })),
        increment: jest.fn((n) => ({ _type: 'increment', value: n })),
        arrayUnion: jest.fn((...items) => ({ _type: 'arrayUnion', items })),
        arrayRemove: jest.fn((...items) => ({ _type: 'arrayRemove', items })),
        delete: jest.fn(() => ({ _type: 'delete' })),
    },
}));

// Mock Secret Manager Client
jest.mock('@google-cloud/secret-manager', () => ({
    SecretManagerServiceClient: jest.fn().mockImplementation(() => ({
        accessSecretVersion: jest.fn().mockResolvedValue([
            { payload: { data: Buffer.from('mock-api-key') } },
        ]),
    })),
}));

// Mock Google Generative AI
jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn(() => ({
            generateContent: jest.fn().mockResolvedValue({
                response: { text: () => 'Mock AI response' },
            }),
        })),
    })),
}));

// Mock fetch globally
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue('{}'),
});

// Suppress console.error in tests (optional - can be removed for debugging)
// console.error = jest.fn();
