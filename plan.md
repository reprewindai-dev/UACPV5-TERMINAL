1. **Add `type="button"` to non-submit buttons in `src/App.tsx`:**
   - I will search for all `<button>` elements in `src/App.tsx` and ensure that `type="button"` is added to all buttons that are not intended to submit a form (which should be all of them, since they use `onClick` handlers). This improves accessibility and prevents unexpected form submission issues in the future, as per learning from `.Jules/palette.md`.
2. **Run verifications (build, tests, linters):**
   - I will run the required verification commands: `pnpm build`, `pnpm run test:runtime-port`, `pnpm run test:intervention-truth`, and `pnpm lint`.
3. **Complete pre-commit steps:**
   - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
4. **Create PR:**
   - I will submit the PR with the title '🎨 Palette: [UX improvement]' and the required description format.
