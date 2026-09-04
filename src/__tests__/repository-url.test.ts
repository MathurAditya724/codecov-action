import { describe, expect, it } from "vitest";
import { parseRepositoryReference } from "../../website/src/lib/repository-url.js";

describe("parseRepositoryReference", () => {
  it.each([
    [
      "getsentry/coverage-action",
      { owner: "getsentry", repo: "coverage-action" },
    ],
    [
      "github.com/getsentry/coverage-action",
      { owner: "getsentry", repo: "coverage-action" },
    ],
    [
      "https://github.com/getsentry/coverage-action.git",
      { owner: "getsentry", repo: "coverage-action" },
    ],
  ])("parses supported repository references", (value, expected) => {
    expect(parseRepositoryReference(value)).toEqual(expected);
  });

  it.each([
    "github.com/getsentry",
    "https://example.com/github.com/getsentry/coverage-action",
    "https://github.com.example.com/getsentry/coverage-action",
    "https://github.com@evil.example/getsentry/coverage-action",
  ])("rejects URLs that do not target github.com", (value) => {
    expect(parseRepositoryReference(value)).toBeNull();
  });
});
