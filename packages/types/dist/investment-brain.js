"use strict";
/**
 * P2-01: Shared Investment Brain ↔ Gateway Schema Contract
 *
 * This file defines the TypeScript interfaces that mirror the Python
 * InvestmentAgentState, ensuring compile-time type safety for the
 * Gateway → Brain → Gateway data flow.
 *
 * The Python counterpart is in:
 *   services/investment-brain/src/graph/state.py
 *
 * ⚠️ SYNC RULE: The core types are now auto-generated in investmentState.ts.
 *    Any change to state.py's TypedDict fields MUST be reflected there.
 *    Run `npm run typecheck` to verify.
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
__exportStar(require("./investmentState"), exports);
