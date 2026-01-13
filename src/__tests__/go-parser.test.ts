import { describe, expect, it } from "vitest";
import { GoParser } from "../parsers/go-parser.js";

describe("GoParser", () => {
  const sampleGoCoverage = `mode: set
github.com/user/project/pkg/math.go:5.14,7.2 1 1
github.com/user/project/pkg/math.go:9.16,11.2 1 1
github.com/user/project/pkg/math.go:13.18,15.2 1 0
github.com/user/project/pkg/math.go:17.20,19.2 1 1
github.com/user/project/pkg/utils.go:3.10,5.2 1 1
github.com/user/project/pkg/utils.go:7.12,10.2 2 1
github.com/user/project/pkg/utils.go:12.14,14.2 1 0
`;

  it("should parse Go coverage profile correctly", async () => {
    const parser = new GoParser();
    const result = await parser.parseContent(sampleGoCoverage);

    expect(result.files).toHaveLength(2);
  });

  it("should calculate correct coverage metrics", async () => {
    const parser = new GoParser();
    const result = await parser.parseContent(sampleGoCoverage);

    // math.go: 4 statements, 3 covered
    // utils.go: 4 statements (1 + 2 + 1), 3 covered (1 + 2 + 0)
    // Total: 8 statements, 6 covered
    expect(result.metrics.statements).toBe(8);
    expect(result.metrics.coveredStatements).toBe(6);
    expect(result.metrics.lineRate).toBe(75);

    // Go coverage doesn't track branches
    expect(result.metrics.conditionals).toBe(0);
    expect(result.metrics.branchRate).toBe(0);
  });

  it("should parse file coverage correctly", async () => {
    const parser = new GoParser();
    const result = await parser.parseContent(sampleGoCoverage);

    const mathFile = result.files.find((f) =>
      f.path.includes("pkg/math.go")
    );
    expect(mathFile).toBeDefined();
    expect(mathFile!.name).toBe("math.go");
    expect(mathFile!.statements).toBe(4);
    expect(mathFile!.coveredStatements).toBe(3);
    expect(mathFile!.lineRate).toBe(75);

    const utilsFile = result.files.find((f) =>
      f.path.includes("pkg/utils.go")
    );
    expect(utilsFile).toBeDefined();
    expect(utilsFile!.statements).toBe(4);
    expect(utilsFile!.coveredStatements).toBe(3);
  });

  it("should parse line coverage correctly", async () => {
    const parser = new GoParser();
    const result = await parser.parseContent(sampleGoCoverage);

    const mathFile = result.files.find((f) =>
      f.path.includes("pkg/math.go")
    );

    // Lines 5-7 should be covered (block 1)
    const line5 = mathFile!.lines.find((l) => l.lineNumber === 5);
    expect(line5?.count).toBe(1);

    const line7 = mathFile!.lines.find((l) => l.lineNumber === 7);
    expect(line7?.count).toBe(1);

    // Lines 13-15 should be uncovered (block 3)
    const line13 = mathFile!.lines.find((l) => l.lineNumber === 13);
    expect(line13?.count).toBe(0);

    const line15 = mathFile!.lines.find((l) => l.lineNumber === 15);
    expect(line15?.count).toBe(0);
  });

  it("should detect Go coverage format correctly", () => {
    const parser = new GoParser();

    expect(parser.canParse(sampleGoCoverage)).toBe(true);
    expect(parser.canParse(sampleGoCoverage, "coverage.out")).toBe(true);
    expect(parser.canParse(sampleGoCoverage, "cover.out")).toBe(true);
    expect(parser.canParse(sampleGoCoverage, "profile.coverprofile")).toBe(
      true
    );

    // Should not match XML
    expect(parser.canParse("<coverage></coverage>", "coverage.xml")).toBe(
      false
    );

    // Should not match LCOV
    expect(parser.canParse("SF:/path\nDA:1,5\nend_of_record", "lcov.info")).toBe(
      false
    );
  });

  it("should handle count mode", async () => {
    const countMode = `mode: count
github.com/user/project/file.go:1.1,3.2 1 10
github.com/user/project/file.go:5.1,7.2 1 5
`;

    const parser = new GoParser();
    const result = await parser.parseContent(countMode);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].coveredStatements).toBe(2);
  });

  it("should handle atomic mode", async () => {
    const atomicMode = `mode: atomic
github.com/user/project/file.go:1.1,3.2 1 1
github.com/user/project/file.go:5.1,7.2 1 0
`;

    const parser = new GoParser();
    const result = await parser.parseContent(atomicMode);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].statements).toBe(2);
    expect(result.files[0].coveredStatements).toBe(1);
  });

  it("should handle content without mode line", async () => {
    const noMode = `github.com/user/project/file.go:1.1,3.2 1 1
github.com/user/project/file.go:5.1,7.2 1 0
`;

    const parser = new GoParser();
    const result = await parser.parseContent(noMode);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].statements).toBe(2);
    expect(result.files[0].coveredStatements).toBe(1);
  });

  it("should handle overlapping line ranges", async () => {
    // Multiple blocks covering the same lines should take max count
    const overlapping = `mode: set
github.com/user/project/file.go:1.1,5.2 1 1
github.com/user/project/file.go:3.1,7.2 1 0
`;

    const parser = new GoParser();
    const result = await parser.parseContent(overlapping);

    // Lines 1-2: count=1, lines 3-5: max(1,0)=1, lines 6-7: count=0
    const file = result.files[0];

    const line3 = file.lines.find((l) => l.lineNumber === 3);
    expect(line3?.count).toBe(1); // Max of overlapping blocks

    const line6 = file.lines.find((l) => l.lineNumber === 6);
    expect(line6?.count).toBe(0);
  });

  it("should handle empty content", async () => {
    const parser = new GoParser();
    const result = await parser.parseContent("");

    expect(result.files).toHaveLength(0);
    expect(result.metrics.statements).toBe(0);
  });

  it("should handle only mode line", async () => {
    const parser = new GoParser();
    const result = await parser.parseContent("mode: set\n");

    expect(result.files).toHaveLength(0);
  });

  it("should have correct format property", () => {
    const parser = new GoParser();
    expect(parser.format).toBe("go");
  });
});
