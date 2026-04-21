# XXT-AGENT Model-Specific Execution Manifest

**Version**: 1.0.0
**Date**: 2026-04

This document classifies all pending tasks across the implementation plan and task tracker based on the optimal AI model to execute them. By switching between models in the Antigravity gateway, the developer can leverage the unique strengths of each LLM.

## 1. Claude 3.5/4.6 Sonnet (Coding & Refactoring Engine)

**Strengths**: Best-in-class coding capabilities, fast iteration, excellent at handling large file refactors and React/Next.js UI generation.

**Execution Tasks**:
- **Nova HR Widget Implementation**: Building `HRWidget.tsx` with Carbon Copper V5 styles, animations, and responsive layouts.
- **Cross-Agent Collaboration (Write Request Queue)**: Implementing the `WriteRequestQueue` logic in `services/openclaw-gateway/src/services/write-request-queue.ts`.
- **API Handler Development**: Writing the robust, type-safe API handlers in `apps/functions/src/handlers/hr.handler.ts`.
- **Automated Tests Generation**: Writing Jest/Vitest integration and unit tests.

## 2. Gemini 2.0 Flash / 2.5 Flash (Data & Retrieval Engine)

**Strengths**: Extremely fast, massive context window (up to 2M tokens), multimodal input, good for RAG and parsing large documents.

**Execution Tasks**:
- **Market Data Streamer Parsing**: Processing massive JSON/CSV streams for the `market-streamer`.
- **Log Analysis**: Analyzing massive Cloud Run and Firebase log files for debugging and trace analysis.
- **Documentation Ingestion**: Parsing massive OpenAPI/Swagger documentation or legal PDFs (e.g., Labor Standards Act updates).

## 3. Gemini 3.1 Pro / GPT-4o (Reasoning & Orchestration Engine)

**Strengths**: Deep reasoning, complex problem solving, high capability for multi-step planning and architecture design.

**Execution Tasks**:
- **Triple Fusion Engine Optimization**: Refining the algorithms for correlating Market, News, and Social pulses.
- **Agent Personality & Prompt Design**: Optimizing system prompts (like `nova.ts`, `accountant.ts`) for better JSON tool-calling adherence.
- **Architecture Reviews**: Conducting security and architecture audits across the platform.

## 4. Claude 3/4 Opus (Deep Strategy Engine)

**Strengths**: Nuanced understanding, creative and strategic thinking, producing high-quality prose and system narratives.

**Execution Tasks**:
- **Financial & Tax Strategy Planning**: Structuring complex tax compliance strategies and multi-tenant logic.
- **Agent Lore & Constitution**: Writing and updating the `governance/constitution.md` and backstory for the agents.

## Workflow Integration

When tackling a specific domain, the user is encouraged to switch the active model in the Antigravity configuration to match the task's corresponding profile above.

1. **Architecture & Planning** -> Gemini 3.1 Pro / GPT-4o
2. **Implementation & Refactoring** -> Claude Sonnet
3. **Log & Data Processing** -> Gemini 2.5 Flash
4. **Strategic Documentation** -> Claude Opus
