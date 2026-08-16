## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.
## 2024-08-16 - Form Label Accessibility
**Learning:** The LiveTelemetry component's form fields were missing programmatic associations between their labels and inputs. Adding `htmlFor` and `id` ensures that screen readers correctly identify the fields and improves clickability for mouse users.
**Action:** Ensure all future form fields explicitly connect labels to inputs via `htmlFor` and `id` attributes.
