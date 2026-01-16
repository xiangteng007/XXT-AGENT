# LINE-Notion Dashboard

Multi-tenant admin dashboard for the LINE to Notion automation platform.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Auth**: Firebase Authentication (Google Sign-in)
- **Database**: Firestore (via Firebase Admin SDK)
- **Deployment**: Vercel

## Prerequisites

1. Firebase project with:
   - Authentication enabled (Google provider)
   - Firestore database
   - Service account key for Admin SDK

2. Node.js 18+

## Setup

### 1. Clone and Install

```bash
cd dashboard
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Firebase credentials:

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Firebase Admin SDK (Server-side)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 3. Bootstrap First Admin

Create the first owner admin in Firestore:

```bash
# Using Firebase Console or Admin SDK
# Collection: admins
# Document ID: <your-firebase-uid>
# Fields:
{
  "enabled": true,
  "role": "owner",
  "allowTenants": [],  // Empty = access all
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}
```

Or run the bootstrap script:

```bash
npm run bootstrap-admin -- --email your-email@example.com
```

### 4. Run Locally

```bash
npm run dev
```

Open <http://localhost:3000>

## Features

| Page | Function |
|------|----------|
| `/login` | Google sign-in |
| `/` | Dashboard home with stats |
| `/tenants` | Tenant CRUD |
| `/rules` | Rules CRUD + test matcher |
| `/mappings` | Field mappings |
| `/jobs` | Queue jobs + requeue/ignore |
| `/logs` | Operation logs |
| `/metrics` | Daily metrics |

## RBAC Roles

| Role | Permissions |
|------|-------------|
| `owner` | Full access (including admin management) |
| `admin` | CRUD tenants/rules/mappings, requeue jobs |
| `viewer` | Read-only access |

## Deployment

### Vercel

1. Connect repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy

```bash
vercel --prod
```

## API Routes

All routes require `Authorization: Bearer <firebase-id-token>`:

- `GET/POST /api/admin/tenants`
- `GET/PUT/DELETE /api/admin/tenants/:id`
- `GET/POST /api/admin/rules?tenantId=xxx`
- `GET/PUT/DELETE /api/admin/rules/:id?tenantId=xxx`
- `POST /api/admin/rules/test`
- `GET/POST /api/admin/mappings?tenantId=xxx`
- `GET /api/admin/jobs?status=xxx`
- `POST /api/admin/jobs/:id/requeue`
- `POST /api/admin/jobs/:id/ignore`
- `GET /api/admin/logs?type=xxx`
- `GET /api/admin/metrics?tenantId=xxx`

## Security

- All API routes verify Firebase ID token server-side
- RBAC checks enforce role-based access
- Sensitive data (secrets) never exposed client-side
- Firestore Security Rules prevent direct client writes
