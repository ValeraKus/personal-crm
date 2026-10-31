import { describe, expect, it } from "vitest";

import { parseGroupIds } from "@/lib/ids";

describe("parseGroupIds", () => {
  it("returns one id", () => {
    expect(parseGroupIds("3")).toEqual([3]);
  });

  it("returns several ids in the given order", () => {
    expect(parseGroupIds(["7", "3"])).toEqual([7, 3]);
  });

  it("drops repeated ids", () => {
    expect(parseGroupIds(["3", "7", "3"])).toEqual([3, 7]);
  });

  it("drops values that are not ids", () => {
    expect(parseGroupIds(["abc", "3", "0", "-1", "2.5", ""])).toEqual([3]);
  });

  it("returns an empty list when there is no parameter", () => {
    expect(parseGroupIds(undefined)).toEqual([]);
  });
});
