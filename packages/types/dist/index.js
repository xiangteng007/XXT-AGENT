"use strict";
/**
 * Shared Types for XXT-AGENT Monorepo
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMPANY_ENTITY_TYPES = exports.ALL_ENTITY_TYPES = void 0;
// OpenClaw Contracts (PR-1)
__exportStar(require("./openclaw"), exports);
// Agent Types (B-4 — v8.0 型別共享)
__exportStar(require("./agents"), exports);
// Investment Brain Schema Contract (P2-01)
__exportStar(require("./investment-brain"), exports);
/** 所有合法的 EntityType 值（Runtime 驗證用）*/
exports.ALL_ENTITY_TYPES = [
    'personal', 'family',
    'co_drone', 'co_construction', 'co_renovation', 'co_design',
    'assoc_rescue',
];
/** 所有公司實體 */
exports.COMPANY_ENTITY_TYPES = [
    'co_drone', 'co_construction', 'co_renovation', 'co_design',
];
