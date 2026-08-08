import assert from "node:assert/strict";
import { resolveRuntimePort } from "./runtime-port.mjs";

assert.equal(resolveRuntimePort(undefined, "development"), 80);
assert.equal(resolveRuntimePort("80", "production"), 80);
assert.equal(resolveRuntimePort("8080", "development"), 8080);

for (const forbidden of ["3000", "8000"]) {
  assert.throws(
    () => resolveRuntimePort(forbidden, "development"),
    /forbidden for canonical Terminal/,
  );
}

assert.throws(
  () => resolveRuntimePort("8080", "production"),
  /Production Terminal must listen on canonical port 80/,
);
assert.throws(() => resolveRuntimePort("not-a-port", "development"), /PORT must be an integer/);
assert.throws(() => resolveRuntimePort("70000", "development"), /PORT must be an integer/);

console.log("Terminal runtime port regression checks passed");
