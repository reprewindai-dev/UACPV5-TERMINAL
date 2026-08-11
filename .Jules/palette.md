## 2024-08-05 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (like map controls and close buttons) missing `aria-label` attributes across different components, which hinders screen reader accessibility.
**Action:** Add `aria-label` to all icon-only buttons to ensure their purpose is communicated to assistive technologies.
## 2023-08-11 - Connect Form Labels to Inputs
**Learning:** Found an accessibility issue pattern in the `AmbientIntervention.tsx` component where custom form inputs were not properly associated with their labels programmatically, despite being visually grouped. This prevents screen readers from announcing the label when the input is focused, and limits the clickable target area.
**Action:** Always ensure custom forms use `htmlFor` on the label and matching `id` on the input to explicitly tie them together, improving both screen reader experience and mouse/touch targets.
