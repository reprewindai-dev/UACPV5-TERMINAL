import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../src/components/AmbientIntervention.tsx", import.meta.url),
  "utf8",
);

test("browser intervention cannot manufacture governance or payment success", () => {
  assert.doesNotMatch(source, /AmbientInterventionResolved/);
  assert.doesNotMatch(source, /approved:\s*true/);
  assert.doesNotMatch(source, /vnp_injected/);
  assert.doesNotMatch(source, /15\.00 VNP/);
  assert.doesNotMatch(source, /45\.00 VNP/);
  assert.match(source, /NOT_VERIFIED/);
});

test("browser intervention does not collect or broadcast provider credentials", () => {
  assert.doesNotMatch(source, /api_key:\s*apiKey/);
  assert.doesNotMatch(source, /type="password"/);
  assert.doesNotMatch(source, /Inject Credential/);
  assert.match(source, /Credential submission is unavailable in this browser surface/);
  assert.match(source, /does not broadcast provider keys through/);
});

test("privileged resolution remains blocked until a governed backend contract exists", () => {
  assert.match(source, /cannot approve or release a quarantine/);
  assert.match(source, /cannot create or confirm settlement/);
  assert.match(source, /execution remains blocked/);
});
