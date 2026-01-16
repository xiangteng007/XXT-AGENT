# LINE-to-Notion Multi-Tenant Platform — Integration Plan

**Audit Date**: 2026-01-15  
**Status**: Phase 0 Complete ✅

---

## 1. Executive Summary

This document outlines the complete integration and refactoring plan for the SENTENG-LINEBOT-NOTION platform. The codebase is well-structured but requires critical enhancements for production reliability.

### Current State

- ✅ Single entry point (webhook.handler.ts)
- ✅ Modular services (5 services, no duplication)
- ✅ Well-defined models (Team, Project, Rule, Integration)
- ✅ Firestore rules with proper RBAC
- ✅ Secret Manager integration
- ✅ Retry logic in Notion service

### Critical Gaps

| Priority | Issue | Risk |
|----------|-------|------|
| 🔴 P0 | **No queue/DLQ** — Notion writes block webhook response | Webhook timeout (60s limit) |
| 🔴 P0 | **rawBody signature bug** — Uses `JSON.stringify(req.body)` instead of actual rawBody | Security vulnerability |
| 🟡 P1 | Only text messages supported | Feature gap |
| 🟡 P1 | No admin dashboard | Operational gap |
| 🟡 P1 | No event deduplication | Replay attacks possible |
| 🟢 P2 | No metrics/reporting | Observability gap |

---

## 2. Current Architecture

### A) Endpoints/Handlers

| File | Function | Status |
|------|----------|--------|
| `handlers/webhook.handler.ts` | LINE webhook entry | ⚠️ Needs queue |
| `handlers/index.ts` | Barrel export | ✅ OK |

### B) Services

| Service | Responsibility | Status |
|---------|----------------|--------|
| `line.service.ts` | Verify signature, reply, get content | ✅ OK |
| `notion.service.ts` | Write/update pages, retry logic | ✅ OK |
| `rules.service.ts` | Rule matching, property building | ✅ OK |
| `tenant.service.ts` | Tenant config loading, caching | ✅ OK |
| `secrets.service.ts` | Secret Manager access | ✅ OK |

### C) Missing Services (Required)

| Service | Purpose |
|---------|---------|
| `queue.service.ts` | Cloud Tasks enqueue/dequeue |
| `mapper.service.ts` | Normalize messages → Notion properties |
| `storage.service.ts` | GCS upload + signed URLs |
| `metrics.service.ts` | Write daily aggregates |
| `audit.service.ts` | Event deduplication + logs |
| `ocr.service.ts` | Image text extraction (stub) |

### D) Duplicate/Obsolete Files

**None found** — codebase is clean.

---

## 3. Critical Bugs to Fix

### Bug 1: rawBody Signature Verification (🔴 SECURITY)

**Location**: `webhook.handler.ts:61`

```typescript
// CURRENT (WRONG):
const rawBody = JSON.stringify(req.body);

// CORRECT:
// Must use actual raw request body, not re-serialized JSON
```

**Fix**: Use `express.raw()` middleware or `req.rawBody` from Cloud Functions.

### Bug 2: Notion Writes Block Webhook (🔴 RELIABILITY)

**Location**: `webhook.handler.ts:159`

```typescript
// CURRENT: Direct call blocks webhook
const notionResult = await writeToNotion({...});

// REQUIRED: Enqueue job, return immediately
await enqueueJob({tenantId, payload, route});
res.status(200).send('OK');
```

---

## 4. Target Directory Structure

```
functions/src/
├── index.ts                    # Entry point (webhook + worker exports)
├── config/                     # Firebase, etc.
├── handlers/
│   ├── webhook.handler.ts      # LINE webhook → quick ACK → enqueue
│   └── worker.handler.ts       # NEW: Queue consumer → Notion writes
├── services/
│   ├── line.service.ts         # Signature, reply, content download
│   ├── notion.service.ts       # Write/update with retry
│   ├── rules.service.ts        # Rule matching engine
│   ├── tenant.service.ts       # Tenant config loader
│   ├── secrets.service.ts      # Secret Manager
│   ├── queue.service.ts        # NEW: Cloud Tasks abstraction
│   ├── mapper.service.ts       # NEW: Message → Notion properties
│   ├── storage.service.ts      # NEW: GCS upload
│   ├── metrics.service.ts      # NEW: Daily aggregates
│   ├── audit.service.ts        # NEW: Dedup + logs
│   └── ocr.service.ts          # NEW: Vision OCR (stub)
├── models/
│   ├── index.ts                # Existing models
│   ├── job.model.ts            # NEW: Queue job schema
│   └── normalized-message.ts   # NEW: Unified message format
├── types/
└── utils/

dashboard/                      # NEW: Next.js admin panel
├── src/app/
├── package.json
└── ...

docs/
├── INTEGRATION_PLAN.md         # This file
├── ARCHITECTURE_FINAL.md       # Post-integration
└── SYSTEM_ARCHITECTURE.md      # Existing
```

---

## 5. Firestore Collections Plan

| Collection | Purpose | Status |
|------------|---------|--------|
| `/teams/{teamId}` | Tenant root | ✅ Exists |
| `/teams/{teamId}/projects/{projectId}` | Projects | ✅ Exists |
| `/teams/{teamId}/projects/{projectId}/rules/{ruleId}` | Rules | ✅ Exists |
| `/integrations/{integrationId}` | LINE/Notion integrations | ✅ Exists |
| `/logs/{logId}` | Operation logs | ✅ Exists |
| `/processedEvents/{eventKey}` | Deduplication | ⚠️ Schema only |
| `/jobs/{jobId}` | Queue jobs | 🆕 NEW |
| `/metrics_daily/{tenantId_date}` | Daily counters | 🆕 NEW |
| `/mappings/{mappingId}` | Field mappings | 🆕 NEW |

---

## 6. Phase Execution Plan

### Phase 1: Architecture Unification

- [ ] Fix rawBody signature verification
- [ ] Create `worker.handler.ts` for queue consumption
- [ ] Create `queue.service.ts` (Cloud Tasks)
- [ ] Create `audit.service.ts` (deduplication)
- [ ] Update webhook to enqueue instead of direct Notion call
- [ ] Update `index.ts` to export both handlers

### Phase 2: Dedup & Cleanup

- [ ] Implement `processedEvents` check in webhook
- [ ] Add correlation IDs (eventId, jobId)
- [ ] Verify no duplicate code paths

### Phase 3: Queue + Retry + DLQ

- [ ] Cloud Tasks queue with retry policy
- [ ] Job status tracking in Firestore
- [ ] DLQ handling for failed jobs
- [ ] Per-tenant rate limiting

### Phase 4: Security & Audit

- [ ] Fix rawBody extraction
- [ ] Audit all Secret Manager usage
- [ ] Structured logging with correlation
- [ ] Add request validation middleware

### Phase 5: Admin Dashboard MVP

- [ ] Next.js app with Firebase Auth
- [ ] Tenant management UI
- [ ] Rules CRUD
- [ ] Logs viewer
- [ ] Jobs queue monitor

### Phase 6: Message Type Expansion

- [ ] Create `normalized-message.model.ts`
- [ ] Create `mapper.service.ts`
- [ ] Add image handling (GCS upload)
- [ ] Add location handling (Google Maps URL)
- [ ] Add OCR stub

### Phase 7: Metrics & Reporting

- [ ] Create `metrics.service.ts`
- [ ] Daily aggregate writes
- [ ] Dashboard metrics view

---

## 7. Test Requirements

| Test | Description |
|------|-------------|
| `rules.matcher.test.ts` | prefix/keyword/contains/regex |
| `signature.verify.test.ts` | HMAC with timingSafeEqual |
| `notion.retry.test.ts` | 429/5xx retry logic |
| `mapper.text.test.ts` | text → Notion properties |
| `mapper.location.test.ts` | location → Notion mapping |
| `queue.service.test.ts` | enqueue/dequeue mocks |

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Webhook timeout | Queue-based architecture (Phase 1) |
| Notion rate limits | Per-tenant rate limiting + retry |
| Replay attacks | processedEvents deduplication |
| Config drift | Firestore hot-reload + cache invalidation |
| Data loss | DLQ + job retry tracking |

---

## 9. Success Criteria

- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Local emulator e2e: webhook → queue → worker → logs
- [ ] 6+ unit tests passing
- [ ] Dashboard can manage tenants/rules
- [ ] Image messages create Notion pages with file links
- [ ] Location messages include Google Maps URL

---

## 10. Next Steps

**Immediate Action**: Begin Phase 1 — Fix rawBody and create queue architecture.

Proceed to Phase 1? (**request user approval**)
