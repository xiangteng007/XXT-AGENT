---
name: stitch-react-components
description: Guidelines for writing robust React functional components intended to interface with the StitchMCP generated UI layers.
---

# Stitch React Components

## UI Generation Protocol
When generating components using `StitchMCP` design definitions:
1. **Stateless Dominance**: Keep generated views as stateless pure functions where possible.
2. **Prop Drilling**: Avoid deep prop drilling; use Context API or state managers for global metrics (like agent presence in War Room).
3. **Component Reusability**: Do not hardcode values inside generic UI constructs like `Card` or `Alert`. Pass them as `children` or named slots.

## Integration with Agentic Events
- Use React `useEffect` cleanups diligently when subscribing to OpenClaw Gateway Websocket events inside a component.
- Example: Ensure `socket.off('INTELLIGENCE_DISCOVERED')` is always called when unmounting a War Room chat component to prevent memory leaks.
