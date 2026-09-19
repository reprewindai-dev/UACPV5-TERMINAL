## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.

## 2026-08-12 - Interactive elements accessibility
**Learning:** The bottom navigation bar in App.tsx used `div` elements with `onClick` handlers, making them inaccessible to keyboard and screen reader users.
**Action:** Replaced `div`s with `button` elements, added `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-hidden="true"` on decorative SVGs. Reset default button styles in index.css to prevent visual regressions.
## 2026-08-14 - Form Input Labels & Accessible Inputs
**Learning:** Visible text labels and context aren't enough for screen readers; they need explicit associations (htmlFor/id) or aria-label attributes when isolated.
**Action:** Always link visible labels to inputs using htmlFor and id, and explicitly add aria-labels to standalone inputs or selects (e.g. search boxes, filter dropdowns).
## 2025-02-21 - Focus-visible styling requires real keyboard emulation
**Learning:** When using Playwright to verify focus-visible classes on elements, programmatic `.focus()` calls might not reliably trigger the styles. True keyboard emulation using sequential `page.keyboard.press("Tab")` events is often necessary to correctly simulate and capture keyboard focus states.
**Action:** When testing keyboard accessibility styles, prefer simulating tab navigation from a known starting point rather than using direct JavaScript/Playwright `.focus()` methods.
## 2024-09-19 - Ensure Focus Ring Visibility in Tab Groups
**Learning:** When adding focus rings to tightly packed element groups (like segment controls or tab lists), the default `box-shadow` rendered by Tailwind's `ring` utility can be visually obscured by adjacent elements rendering over it.
**Action:** Use `relative z-10` on active/focused elements within tightly coupled groups to ensure the focus ring renders above adjacent peers.
