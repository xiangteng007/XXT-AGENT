---
name: vercel-react-best-practices
description: Next.js and React best practices based on Vercel's official guidelines. Use when writing React components, Next.js pages, and Server Actions.
---

# Vercel React Best Practices

## Core Principles
1. **Server Components by Default**: Always use React Server Components (RSC) unless interactivity (hooks like `useState`, `useEffect`) is explicitly required. Add `'use client'` only at the boundary.
2. **Data Fetching**: Fetch data inside Server Components using standard `async/await`. Avoid `useEffect` for data fetching.
3. **Mutations**: Use **Server Actions** for form submissions and data mutations. Never expose sensitive keys in Client Components.
4. **Suspense Boundaries**: Wrap async components in `<Suspense>` to enable streaming rendering.
5. **Caching**: Leverage `Next Cache` appropriately tags and revalidation.

## Component Structure
- Keep components small and focused.
- Co-locate styles and tests with the component.
- Use explicit prop typing.
