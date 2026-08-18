## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.

## 2024-10-10 - Unlinked Form Labels and Missing ARIA Labels on Search Inputs
**Learning:** Encountered inputs with visual labels disconnected programmatically (no `id`/`htmlFor`) and search inputs lacking explicit textual labels or `aria-label`s, creating barriers for assistive technologies.
**Action:** Use `id` and `htmlFor` to bind visible labels to their inputs, and apply descriptive `aria-label`s to inputs that rely solely on placeholders or nearby icons for context.
