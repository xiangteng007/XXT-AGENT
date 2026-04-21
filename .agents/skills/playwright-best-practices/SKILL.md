---
name: playwright-best-practices
description: Advanced Playwright automation practices for Argus OSINT Crawlers. Focuses on anti-bot stealth and dynamic scraping.
---

# Playwright OSINT Best Practices

## Stealth & Evasion
1. **User Agents**: Always randomize or use standard highly-adopted User Agent strings when initializing Contexts.
2. **Headless Limitations**: Avoid defaulting to Headless out-of-the-box if the target tracks WebDriver heuristics. Use `playwright-stealth` where appropriate.
3. **Timeouts & Delays**: Introduce jitter (randomized human-like delays) between page interactions (`page.waitForTimeout(Math.random() * 2000)`).

## Resiliency
- **Dynamic Selectors**: Target resilient attributes like data-test-id or semantic text (`page.getByRole`) rather than fragile CSS classes.
- **Interception**: Block unnecessary resources (images, fonts, heavy scripts) via `route.abort()` to radically speed up crawler execution.
- **Error Handling**: Wrap all actions in try/catch blocks and ensure `page.close()` and `browser.close()` are triggered in a `finally` block to prevent zombified browser instances.
