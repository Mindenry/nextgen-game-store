import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** 1×1 transparent PNG used as a fake payment slip in tests. */
export function slipBuffer(): Buffer {
  return readFileSync(resolve("tests/e2e/fixtures/slip.png"));
}
