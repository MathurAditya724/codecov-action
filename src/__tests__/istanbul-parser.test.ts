import { describe, expect, it } from "vitest";
import { IstanbulParser } from "../parsers/istanbul-parser.js";

describe("IstanbulParser", () => {
  const sampleIstanbulJSON = JSON.stringify({
    "/src/utils/math.ts": {
      path: "/src/utils/math.ts",
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 30 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 25 } },
        "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 20 } },
        "3": { start: { line: 5, column: 0 }, end: { line: 5, column: 15 } },
        "4": { start: { line: 6, column: 0 }, end: { line: 6, column: 10 } },
        "5": { start: { line: 8, column: 0 }, end: { line: 8, column: 20 } },
      },
      fnMap: {
        "0": {
          name: "add",
          decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
          loc: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          line: 1,
        },
        "1": {
          name: "subtract",
          decl: { start: { line: 5, column: 0 }, end: { line: 5, column: 15 } },
          loc: { start: { line: 5, column: 0 }, end: { line: 8, column: 1 } },
          line: 5,
        },
      },
      branchMap: {
        "0": {
          loc: { start: { line: 6, column: 0 }, end: { line: 6, column: 10 } },
          type: "if",
          locations: [
            { start: { line: 6, column: 0 }, end: { line: 6, column: 5 } },
            { start: { line: 6, column: 5 }, end: { line: 6, column: 10 } },
          ],
          line: 6,
        },
      },
      s: { "0": 5, "1": 5, "2": 5, "3": 0, "4": 0, "5": 0 },
      f: { "0": 5, "1": 0 },
      b: { "0": [0, 0] },
    },
    "/src/utils/helper.ts": {
      path: "/src/utils/helper.ts",
      statementMap: {
        "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        "1": { start: { line: 2, column: 0 }, end: { line: 2, column: 15 } },
        "2": { start: { line: 3, column: 0 }, end: { line: 3, column: 10 } },
      },
      fnMap: {
        "0": {
          name: "doSomething",
          decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
          loc: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
          line: 1,
        },
      },
      branchMap: {},
      s: { "0": 10, "1": 10, "2": 10 },
      f: { "0": 10 },
      b: {},
    },
  });

  it("should parse Istanbul JSON correctly", async () => {
    const parser = new IstanbulParser();
    const result = await parser.parseContent(sampleIstanbulJSON);

    expect(result.files).toHaveLength(2);
  });

  it("should calculate correct coverage metrics", async () => {
    const parser = new IstanbulParser();
    const result = await parser.parseContent(sampleIstanbulJSON);

    // Total: 9 statements (6 + 3), 6 covered (3 + 3)
    expect(result.metrics.statements).toBe(9);
    expect(result.metrics.coveredStatements).toBe(6);

    // Total: 2 branches, 0 covered
    expect(result.metrics.conditionals).toBe(2);
    expect(result.metrics.coveredConditionals).toBe(0);

    // Total: 3 functions (2 + 1), 2 covered (1 + 1)
    expect(result.metrics.methods).toBe(3);
    expect(result.metrics.coveredMethods).toBe(2);
  });

  it("should parse file coverage correctly", async () => {
    const parser = new IstanbulParser();
    const result = await parser.parseContent(sampleIstanbulJSON);

    const mathFile = result.files.find((f) => f.path === "/src/utils/math.ts");
    expect(mathFile).toBeDefined();
    expect(mathFile!.name).toBe("math.ts");
    expect(mathFile!.statements).toBe(6);
    expect(mathFile!.coveredStatements).toBe(3);
    expect(mathFile!.conditionals).toBe(2);
    expect(mathFile!.coveredConditionals).toBe(0);
    expect(mathFile!.methods).toBe(2);
    expect(mathFile!.coveredMethods).toBe(1);
    expect(mathFile!.lineRate).toBe(50);

    const helperFile = result.files.find(
      (f) => f.path === "/src/utils/helper.ts"
    );
    expect(helperFile).toBeDefined();
    expect(helperFile!.statements).toBe(3);
    expect(helperFile!.coveredStatements).toBe(3);
    expect(helperFile!.lineRate).toBe(100);
    expect(helperFile!.methods).toBe(1);
    expect(helperFile!.coveredMethods).toBe(1);
  });

  it("should parse line coverage correctly", async () => {
    const parser = new IstanbulParser();
    const result = await parser.parseContent(sampleIstanbulJSON);

    const mathFile = result.files.find((f) => f.path === "/src/utils/math.ts");

    // Line 1 should be covered
    const line1 = mathFile!.lines.find((l) => l.lineNumber === 1);
    expect(line1?.count).toBe(5);
    expect(line1?.type).toBe("stmt");

    // Line 6 has branches
    const line6 = mathFile!.lines.find((l) => l.lineNumber === 6);
    expect(line6?.count).toBe(0);
    expect(line6?.type).toBe("cond");

    // Uncovered lines
    const line5 = mathFile!.lines.find((l) => l.lineNumber === 5);
    expect(line5?.count).toBe(0);
  });

  it("should detect Istanbul format correctly", () => {
    const parser = new IstanbulParser();

    expect(parser.canParse(sampleIstanbulJSON)).toBe(true);
    expect(parser.canParse(sampleIstanbulJSON, "coverage-final.json")).toBe(
      true
    );
    expect(parser.canParse(sampleIstanbulJSON, "coverage.json")).toBe(true);

    // Should not match non-Istanbul JSON
    expect(parser.canParse('{"foo": "bar"}', "data.json")).toBe(false);

    // Should not match XML
    expect(parser.canParse("<coverage></coverage>", "coverage.xml")).toBe(
      false
    );

    // Should not match LCOV
    expect(parser.canParse("SF:/path\nDA:1,5\nend_of_record", "lcov.info")).toBe(
      false
    );
  });

  it("should handle empty coverage", async () => {
    const emptyJSON = JSON.stringify({
      "/src/empty.ts": {
        path: "/src/empty.ts",
        statementMap: {
          "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } },
        },
        fnMap: {},
        branchMap: {},
        s: { "0": 0 },
        f: {},
        b: {},
      },
    });

    const parser = new IstanbulParser();
    const result = await parser.parseContent(emptyJSON);

    expect(result.metrics.statements).toBe(1);
    expect(result.metrics.coveredStatements).toBe(0);
    expect(result.metrics.lineRate).toBe(0);
  });

  it("should handle multiple branches on same line", async () => {
    const multiBranchJSON = JSON.stringify({
      "/src/file.ts": {
        path: "/src/file.ts",
        statementMap: {
          "0": { start: { line: 1, column: 0 }, end: { line: 1, column: 50 } },
        },
        fnMap: {},
        branchMap: {
          "0": {
            loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 25 } },
            type: "if",
            locations: [
              { start: { line: 1, column: 0 }, end: { line: 1, column: 12 } },
              { start: { line: 1, column: 12 }, end: { line: 1, column: 25 } },
            ],
            line: 1,
          },
          "1": {
            loc: {
              start: { line: 1, column: 25 },
              end: { line: 1, column: 50 },
            },
            type: "binary-expr",
            locations: [
              { start: { line: 1, column: 25 }, end: { line: 1, column: 37 } },
              { start: { line: 1, column: 37 }, end: { line: 1, column: 50 } },
            ],
            line: 1,
          },
        },
        s: { "0": 5 },
        f: {},
        b: { "0": [3, 2], "1": [5, 0] },
      },
    });

    const parser = new IstanbulParser();
    const result = await parser.parseContent(multiBranchJSON);

    expect(result.files[0].conditionals).toBe(4); // 2 + 2 branches
    expect(result.files[0].coveredConditionals).toBe(3); // 2 + 1 covered
  });

  it("should throw on invalid JSON", async () => {
    const parser = new IstanbulParser();

    await expect(parser.parseContent("not json")).rejects.toThrow(
      "Invalid Istanbul JSON"
    );
  });

  it("should have correct format property", () => {
    const parser = new IstanbulParser();
    expect(parser.format).toBe("istanbul");
  });
});
