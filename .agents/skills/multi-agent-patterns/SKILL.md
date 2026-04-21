---
name: multi-agent-patterns
description: Master orchestrator, peer-to-peer, and hierarchical multi-agent architectures.
---

# Multi-Agent Architectural Patterns

## Orchestrator Pattern (Supervisor)
- Use a central "Supervisor" agent to route tasks to sub-agents (e.g., Argus, Titan, Rusty) based on defined schemas.
- **State Management**: Maintain a central Graph State (like LangGraph) where each agent modifies specific state keys instead of passing massive text context strings.
- **Interruption Mechanisms**: Equip the Supervisor with explicit `<INTERRUPT>` tools to stop endless loops or arguments between agents.

## Peer-to-Peer Consensus (War Room)
- Allow agents to communicate over a pub/sub event bus (like OpenClaw).
- Enforce strict "Vote" formatting so that text generation naturally converges to a decision, lowering token costs.
