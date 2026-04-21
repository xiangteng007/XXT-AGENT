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
export * from './investmentState';
