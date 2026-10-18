## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.

## 2025-03-02 - Icon-Only Button Keyboard Focus State Enhancements
**Learning:** Icon-only buttons used for utility actions across the codebase (e.g. SwarmMap utility icons, RunSpine copy buttons) often miss visible focus states, meaning keyboard-only users cannot discern when those interactive elements are focused.
**Action:** Always verify that interactive elements, especially custom-styled ones, implement `.focus-visible:ring-*` or similar focus styling to maintain keyboard accessibility. In utility items that are usually hidden behind `opacity-0` and appear on hover, ensure `focus-visible:opacity-100` so that keyboard users can tab into them and reveal the action.

## 2025-03-02 - Icon-Only Button Keyboard Focus State Enhancements
**Learning:** Icon-only buttons used for utility actions across the codebase (e.g. SwarmMap utility icons, RunSpine copy buttons) often miss visible focus states, meaning keyboard-only users cannot discern when those interactive elements are focused.
**Action:** Always verify that interactive elements, especially custom-styled ones, implement `.focus-visible:ring-*` or similar focus styling to maintain keyboard accessibility. In utility items that are usually hidden behind `opacity-0` and appear on hover, ensure `focus-visible:opacity-100` so that keyboard users can tab into them and reveal the action.
## 2026-08-12 - Interactive elements accessibility
**Learning:** The bottom navigation bar in App.tsx used `div` elements with `onClick` handlers, making them inaccessible to keyboard and screen reader users.
**Action:** Replaced `div`s with `button` elements, added `role="tablist"`, `role="tab"`, `aria-selected`, and `aria-hidden="true"` on decorative SVGs. Reset default button styles in index.css to prevent visual regressions.
## 2026-08-14 - Form Input Labels & Accessible Inputs
**Learning:** Visible text labels and context aren't enough for screen readers; they need explicit associations (htmlFor/id) or aria-label attributes when isolated.
**Action:** Always link visible labels to inputs using htmlFor and id, and explicitly add aria-labels to standalone inputs or selects (e.g. search boxes, filter dropdowns).

## 2026-08-25 - DataGrid Empty States
**Learning:** Adding empty states inside a grid context (like `visibleRunsSlice.length === 0`) using a styled empty state layout greatly enhances user feedback over just rendering an empty table, especially when multiple filtered lists are toggled dynamically.
**Action:** When working on grid, list, or table views in this app, ensure there is a clear, actionable empty state indicating why results are missing (e.g. "Adjust your search query").
## 2025-02-21 - Focus-visible styling requires real keyboard emulation
**Learning:** When using Playwright to verify focus-visible classes on elements, programmatic `.focus()` calls might not reliably trigger the styles. True keyboard emulation using sequential `page.keyboard.press("Tab")` events is often necessary to correctly simulate and capture keyboard focus states.
**Action:** When testing keyboard accessibility styles, prefer simulating tab navigation from a known starting point rather than using direct JavaScript/Playwright `.focus()` methods.
## 2024-05-18 - Always specify button types
**Learning:** Always explicitly include `type="button"` on `<button>` elements that are not part of a form, especially when adding new UI actions like "clear search". This prevents unintended form submissions if the surrounding DOM structure changes in the future (e.g., if a `div` is changed to a `form`).
**Action:** Ensure all non-submit buttons have `type="button"` by default.

## 2024-03-24 - DataGrid Accessibility Enhancement
**Learning:** Tab selectors and custom input filters within data grids often lack proper ARIA roles (e.g., `role="tablist"`, `role="tab"`) and keyboard focus states, making them difficult for screen reader and keyboard-only users to navigate.
**Action:** Add `role="tablist"` to tab containers, `role="tab"` and `aria-selected` to individual tabs, ensure all interactive buttons have `type="button"` to prevent form submission, and include clear `focus-visible` utility classes for keyboard navigation.
## 2025-03-01 - Sidebar Accessibility\n**Learning:** Implementing  states combined with  on global navigation elements creates a much clearer mental model for keyboard users navigating tabbed layouts, and  in PascalCase shouldn't trigger alarm if it's already defined.\n**Action:** Use  for active tab states alongside high-contrast focus rings in future navigation enhancements.
## 2025-03-01 - Sidebar Accessibility
**Learning:** Implementing `focus-visible` states combined with `aria-current="page"` on global navigation elements creates a much clearer mental model for keyboard users navigating tabbed layouts.
**Action:** Use `aria-current="page"` for active tab states alongside high-contrast focus rings in future navigation enhancements.
## 2024-03-08 - Prevent Actionable Submissions on Empty Inputs
**Learning:** Found that the terminal interface allowed submitting empty commands or attempting to submit commands while the system was already processing ("typing"). This lack of state-based disabling creates confusing UX as it processes invalid inputs and doesn't visually communicate the busy state.
**Action:** Use conditional `disabled` states tied to both input validation (e.g., `!inputVal.trim()`) and processing states (e.g., `isTyping`). Apply `disabled:opacity-50 disabled:cursor-not-allowed` styles and update keyboard event handlers to enforce these same constraints before submitting.
