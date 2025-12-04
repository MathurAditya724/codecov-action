import { describe, expect, it } from "vitest";
import { CoverageComparator } from "../utils/coverage-comparison.js";
import type { AggregatedCoverageResults } from "../types/coverage.js";

describe("CoverageComparator", () => {
  const createMockCoverage = (
    lineRate: number,
    branchRate: number,
    files: Array<{ name: string; path: string; lineRate: number; branchRate: number }>
  ): AggregatedCoverageResults => ({
    totalStatements: 100,
    coveredStatements: Math.round((lineRate / 100) * 100),
    totalConditionals: 50,
    coveredConditionals: Math.round((branchRate / 100) * 50),
    totalMethods: 20,
    coveredMethods: Math.round((lineRate / 100) * 20),
    lineRate,
    branchRate,
    files: files.map((f) => ({
      name: f.name,
      path: f.path,
      statements: 10,
      coveredStatements: Math.round((f.lineRate / 100) * 10),
      conditionals: 5,
      coveredConditionals: Math.round((f.branchRate / 100) * 5),
      methods: 2,
      coveredMethods: Math.round((f.lineRate / 100) * 2),
      lineRate: f.lineRate,
      branchRate: f.branchRate,
      lines: [],
    })),
  });

  it("should detect coverage improvement", () => {
    const baseCoverage = createMockCoverage(70, 60, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 70, branchRate: 60 },
    ]);

    const currentCoverage = createMockCoverage(80, 70, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 80, branchRate: 70 },
    ]);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.deltaLineRate).toBe(10);
    expect(comparison.deltaBranchRate).toBe(10);
    expect(comparison.improvement).toBe(true);
  });

  it("should detect coverage decrease", () => {
    const baseCoverage = createMockCoverage(80, 70, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 80, branchRate: 70 },
    ]);

    const currentCoverage = createMockCoverage(70, 60, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 70, branchRate: 60 },
    ]);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.deltaLineRate).toBe(-10);
    expect(comparison.deltaBranchRate).toBe(-10);
    expect(comparison.improvement).toBe(false);
  });

  it("should detect added files", () => {
    const baseCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 75, branchRate: 65 },
    ]);

    const currentCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 75, branchRate: 65 },
      { name: "file2.ts", path: "/src/file2.ts", lineRate: 80, branchRate: 70 },
    ]);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.filesAdded).toHaveLength(1);
    expect(comparison.filesAdded[0].name).toBe("file2.ts");
    expect(comparison.filesRemoved).toHaveLength(0);
  });

  it("should detect removed files", () => {
    const baseCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 75, branchRate: 65 },
      { name: "file2.ts", path: "/src/file2.ts", lineRate: 80, branchRate: 70 },
    ]);

    const currentCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 75, branchRate: 65 },
    ]);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.filesRemoved).toHaveLength(1);
    expect(comparison.filesRemoved[0].name).toBe("file2.ts");
    expect(comparison.filesAdded).toHaveLength(0);
  });

  it("should detect changed files", () => {
    const baseCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 70, branchRate: 60 },
      { name: "file2.ts", path: "/src/file2.ts", lineRate: 80, branchRate: 70 },
    ]);

    const currentCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 85, branchRate: 75 },
      { name: "file2.ts", path: "/src/file2.ts", lineRate: 65, branchRate: 55 },
    ]);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.filesChanged).toHaveLength(2);

    const file1Change = comparison.filesChanged.find(
      (f) => f.name === "file1.ts"
    );
    expect(file1Change?.deltaLineRate).toBe(15);
    expect(file1Change?.deltaBranchRate).toBe(15);

    const file2Change = comparison.filesChanged.find(
      (f) => f.name === "file2.ts"
    );
    expect(file2Change?.deltaLineRate).toBe(-15);
    expect(file2Change?.deltaBranchRate).toBe(-15);
  });

  it("should not include unchanged files in filesChanged", () => {
    const baseCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 75, branchRate: 65 },
      { name: "file2.ts", path: "/src/file2.ts", lineRate: 80, branchRate: 70 },
    ]);

    const currentCoverage = createMockCoverage(75, 65, [
      { name: "file1.ts", path: "/src/file1.ts", lineRate: 75, branchRate: 65 },
      { name: "file2.ts", path: "/src/file2.ts", lineRate: 80, branchRate: 70 },
    ]);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.filesChanged).toHaveLength(0);
    expect(comparison.deltaLineRate).toBe(0);
    expect(comparison.deltaBranchRate).toBe(0);
    expect(comparison.improvement).toBe(false);
  });

  it("should calculate delta statistics correctly", () => {
    const baseCoverage: AggregatedCoverageResults = {
      totalStatements: 100,
      coveredStatements: 70,
      totalConditionals: 50,
      coveredConditionals: 30,
      totalMethods: 20,
      coveredMethods: 15,
      lineRate: 70,
      branchRate: 60,
      files: [],
    };

    const currentCoverage: AggregatedCoverageResults = {
      totalStatements: 120,
      coveredStatements: 96,
      totalConditionals: 60,
      coveredConditionals: 42,
      totalMethods: 25,
      coveredMethods: 20,
      lineRate: 80,
      branchRate: 70,
      files: [],
    };

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.deltaTotalStatements).toBe(20);
    expect(comparison.deltaCoveredStatements).toBe(26);
    expect(comparison.deltaTotalConditionals).toBe(10);
    expect(comparison.deltaCoveredConditionals).toBe(12);
    expect(comparison.deltaTotalMethods).toBe(5);
    expect(comparison.deltaCoveredMethods).toBe(5);
  });

  it("should generate summary correctly", () => {
    const baseCoverage = createMockCoverage(70, 60, []);
    const currentCoverage = createMockCoverage(80, 70, []);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    const summary = CoverageComparator.getSummary(comparison);

    expect(summary).toContain("📈 Coverage improved!");
    expect(summary).toContain("+10%");
  });

  it("should consider improvement when line coverage increases even if branch stays same", () => {
    const baseCoverage = createMockCoverage(70, 60, []);
    const currentCoverage = createMockCoverage(75, 60, []);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.improvement).toBe(true);
  });

  it("should consider improvement when branch coverage increases with same line coverage", () => {
    const baseCoverage = createMockCoverage(70, 60, []);
    const currentCoverage = createMockCoverage(70, 65, []);

    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      currentCoverage
    );

    expect(comparison.improvement).toBe(true);
  });
});

