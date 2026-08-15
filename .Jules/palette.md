## 2026-08-15 - Bottom Navigation Keyboard Accessibility
**Learning:** Custom navigation bars built with `<div>` elements completely block keyboard users from navigating the application. Converting them to semantic `<button role="tab">` elements instantly restores keyboard navigability and ensures proper screen reader announcement.
**Action:** Always use native semantic elements like `<button>` or `<a>` for interactive controls, and utilize `focus-visible` utility classes to provide clear keyboard focus indicators without penalizing mouse users.
