---
name: tailwind-design-system
description: Guidelines for managing Tailwind CSS variables, tokens, and Carbon Copper styling.
---

# Tailwind Design System

## Carbon Copper Integration
Our system utilizes the proprietary `Carbon Copper` industrial-cyberpunk theme.
When styling elements, strictly adhere to the project's extended Tailwind config:

### Color Palette Constraints
- **Primary**: Use `bg-copper` or `text-copper` (#B87333 equivalent) for main call-to-actions.
- **Surface**: Use `bg-slate-900` or `bg-zinc-900` for container backgrounds to maintain dark-mode dominance.
- **Accent/Alert**: Use `text-amber-500` for warnings, `text-emerald-500` for active/healthy states.

### Utility Strategies
- **Avoid Utility Soup**: For heavily reused button or card constructs, extract to `@layer components` in the `globals.css`.
- **Flex/Grid Layouts**: Use CSS Grid for dashboards (`grid-cols-1 md:grid-cols-2`). Use Flexbox for alignments.
- **Animations**: Apply `transition-all duration-200 ease-in-out` strictly to interactive elements for premium micro-interactions.
