// Deliberately failing test: checks that the protection of main blocks a PR with red CI.
// The PR with this file is closed without merging.

import { expect, it } from "vitest";

it("fails on purpose to check that a red CI blocks the merge", () => {
  expect(1 + 1).toBe(3);
});
