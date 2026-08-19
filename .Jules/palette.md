## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.

## 2025-02-23 - Missing Form Input Accessibility
**Learning:** Found multiple form inputs lacking programmatically associated labels (`htmlFor`/`id` pairs) or `aria-label` attributes for icon-only/invisible label contexts, which hinders screen reader accessibility.
**Action:** Ensure all inputs either have `id` mapped to their text label's `htmlFor` attribute or possess a clear `aria-label` when no visible text label exists.
