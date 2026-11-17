import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 1×1 transparent PNG used as a fake payment slip in tests. */
export function slipBuffer(): Buffer {
  const base = readFileSync(resolve("tests/e2e/fixtures/slip.png"));
  // Unique trailing marker per upload so the duplicate-slip guard is exercised
  // as intended (a real user would upload a distinct transfer slip).
  return Buffer.concat([base, Buffer.from(`NEXTGEN-E2E-${Date.now()}-${Math.random()}`)]);
}
