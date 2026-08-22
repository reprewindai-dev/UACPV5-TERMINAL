## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.

## 2025-03-02 - Icon-Only Button Keyboard Focus State Enhancements
**Learning:** Icon-only buttons used for utility actions across the codebase (e.g. SwarmMap utility icons, RunSpine copy buttons) often miss visible focus states, meaning keyboard-only users cannot discern when those interactive elements are focused.
**Action:** Always verify that interactive elements, especially custom-styled ones, implement `.focus-visible:ring-*` or similar focus styling to maintain keyboard accessibility. In utility items that are usually hidden behind `opacity-0` and appear on hover, ensure `focus-visible:opacity-100` so that keyboard users can tab into them and reveal the action.

## 2025-03-02 - Icon-Only Button Keyboard Focus State Enhancements
**Learning:** Icon-only buttons used for utility actions across the codebase (e.g. SwarmMap utility icons, RunSpine copy buttons) often miss visible focus states, meaning keyboard-only users cannot discern when those interactive elements are focused.
**Action:** Always verify that interactive elements, especially custom-styled ones, implement `.focus-visible:ring-*` or similar focus styling to maintain keyboard accessibility. In utility items that are usually hidden behind `opacity-0` and appear on hover, ensure `focus-visible:opacity-100` so that keyboard users can tab into them and reveal the action.
