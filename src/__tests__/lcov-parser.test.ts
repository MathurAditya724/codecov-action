import { describe, expect, it } from "vitest";
import { LcovParser } from "../parsers/lcov-parser.js";

describe("LcovParser", () => {
  const sampleLcov = `TN:TestSuite
SF:/src/utils/math.ts
FN:1,add
FN:5,subtract
FNDA:5,add
FNDA:0,subtract
FNF:2
FNH:1
DA:1,5
DA:2,5
DA:3,5
DA:5,0
DA:6,0
DA:7,0
BRDA:2,0,0,3
BRDA:2,0,1,2
LF:6
LH:3
BRF:2
BRH:2
end_of_record
SF:/src/utils/helper.ts
FN:1,doSomething
FNDA:10,doSomething
FNF:1
FNH:1
DA:1,10
DA:2,10
DA:3,8
DA:4,8
LF:4
LH:4
BRF:0
BRH:0
end_of_record
`;

  it("should parse LCOV content correctly", async () => {
    const parser = new LcovParser();
    const result = await parser.parseContent(sampleLcov);

    expect(result.files).toHaveLength(2);
  });

  it("should calculate correct coverage metrics", async () => {
    const parser = new LcovParser();
    const result = await parser.parseContent(sampleLcov);

    // Total: 10 lines (6 + 4), 7 hit (3 + 4)
    expect(result.metrics.statements).toBe(10);
    expect(result.metrics.coveredStatements).toBe(7);
    expect(result.metrics.lineRate).toBe(70);

    // Total: 2 branches, 2 hit
    expect(result.metrics.conditionals).toBe(2);
    expect(result.metrics.coveredConditionals).toBe(2);
    expect(result.metrics.branchRate).toBe(100);

    // Total: 3 functions (2 + 1), 2 hit (1 + 1)
    expect(result.metrics.methods).toBe(3);
    expect(result.metrics.coveredMethods).toBe(2);
  });

  it("should parse file coverage correctly", async () => {
    const parser = new LcovParser();
    const result = await parser.parseContent(sampleLcov);

    const mathFile = result.files.find((f) => f.path === "/src/utils/math.ts");
    expect(mathFile).toBeDefined();
    expect(mathFile!.name).toBe("math.ts");
    expect(mathFile!.statements).toBe(6);
    expect(mathFile!.coveredStatements).toBe(3);
    expect(mathFile!.lineRate).toBe(50);
    expect(mathFile!.methods).toBe(2);
    expect(mathFile!.coveredMethods).toBe(1);

    const helperFile = result.files.find(
      (f) => f.path === "/src/utils/helper.ts"
    );
    expect(helperFile).toBeDefined();
    expect(helperFile!.statements).toBe(4);
    expect(helperFile!.coveredStatements).toBe(4);
    expect(helperFile!.lineRate).toBe(100);
  });

  it("should parse line coverage correctly", async () => {
    const parser = new LcovParser();
    const result = await parser.parseContent(sampleLcov);

    const mathFile = result.files.find((f) => f.path === "/src/utils/math.ts");
    expect(mathFile!.lines).toHaveLength(6);

    const line1 = mathFile!.lines.find((l) => l.lineNumber === 1);
    expect(line1?.count).toBe(5);
    expect(line1?.type).toBe("stmt");

    // Line 2 has branches
    const line2 = mathFile!.lines.find((l) => l.lineNumber === 2);
    expect(line2?.count).toBe(5);
    expect(line2?.type).toBe("cond");

    // Uncovered line
    const line5 = mathFile!.lines.find((l) => l.lineNumber === 5);
    expect(line5?.count).toBe(0);
  });

  it("should detect LCOV format correctly", () => {
    const parser = new LcovParser();

    expect(parser.canParse(sampleLcov)).toBe(true);
    expect(parser.canParse(sampleLcov, "lcov.info")).toBe(true);
    expect(parser.canParse(sampleLcov, "coverage.lcov")).toBe(true);
    expect(parser.canParse(sampleLcov, "report.info")).toBe(true);

    // Should not match XML formats
    expect(
      parser.canParse(`<coverage><project></project></coverage>`)
    ).toBe(false);

    // Should not match JSON
    expect(parser.canParse(`{"statementMap": {}}`, "coverage.json")).toBe(
      false
    );
  });

  it("should handle minimal LCOV without summary lines", async () => {
    const minimalLcov = `SF:/src/file.ts
DA:1,5
DA:2,0
DA:3,3
end_of_record
`;

    const parser = new LcovParser();
    const result = await parser.parseContent(minimalLcov);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].statements).toBe(3);
    expect(result.files[0].coveredStatements).toBe(2);
  });

  it("should handle branch data without summary", async () => {
    const lcovWithBranches = `SF:/src/file.ts
DA:1,5
DA:2,3
BRDA:2,0,0,2
BRDA:2,0,1,1
BRDA:2,1,0,0
end_of_record
`;

    const parser = new LcovParser();
    const result = await parser.parseContent(lcovWithBranches);

    expect(result.files[0].conditionals).toBe(3);
    expect(result.files[0].coveredConditionals).toBe(2);
  });

  it("should handle untaken branches marked with dash", async () => {
    const lcovWithDash = `SF:/src/file.ts
DA:1,1
BRDA:1,0,0,-
BRDA:1,0,1,1
end_of_record
`;

    const parser = new LcovParser();
    const result = await parser.parseContent(lcovWithDash);

    expect(result.files[0].conditionals).toBe(2);
    expect(result.files[0].coveredConditionals).toBe(1);
  });

  it("should handle empty content gracefully", async () => {
    const parser = new LcovParser();
    const result = await parser.parseContent("");

    expect(result.files).toHaveLength(0);
    expect(result.metrics.statements).toBe(0);
  });

  it("should have correct format property", () => {
    const parser = new LcovParser();
    expect(parser.format).toBe("lcov");
  });
});
