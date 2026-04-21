---
name: web-design-guidelines
description: Web accessibility (A11y), responsive design, and modern UX guidelines. Use to ensure UI meets enterprise quality.
---

# Web Design Guidelines

## Responsive Web Design (RWD)
- **Mobile First**: Always design core CSS for mobile targets first, overriding with `md:`, `lg:`, `xl:` breakpoints using Tailwind CSS.
- **Fluid Typography**: Utilize robust rem-based spacing instead of hard pixel values.

## Accessibility (A11y)
- **Semantic HTML**: strictly use `<button>` for actions, `<a>` for navigation, and `<nav>`, `<main>`, `<article>` appropriately.
- **ARIA Attributes**: Apply `aria-label`, `aria-hidden`, and `aria-expanded` on interactive dynamic UI elements (like Modals and War Room Interfaces).
- **Contrast**: Ensure text passes standard WCAG AAA contrast checks against the background.

## UI Feedback
- Provide distinct visual states for `Hover`, `Focus`, `Active`, and `Disabled`.
- Always wrap non-instant actions with Loading Spinners or Skeleton loaders.
