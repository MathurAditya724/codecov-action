import { describe, expect, it } from "vitest";
import { PatchAnalyzer } from "../analyzers/patch-analyzer.js";
import type { AggregatedCoverageResults } from "../types/coverage.js";

describe("PatchAnalyzer", () => {
  // Sample diff content
  const sampleDiff = `diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,14 @@ export function sum(a: number, b: number): number {
   return a + b;
 }
 
+export function subtract(a: number, b: number): number {
+  return a - b;
+}
+
+export function multiply(a: number, b: number): number {
+  if (a === 0 || b === 0) {
+    return 0;
+  }
+  return a * b;
+}
+
 export function divide(a: number, b: number): number {
   if (b === 0) {
`;

  // Mock coverage results
  const mockCoverage: AggregatedCoverageResults = {
    totalStatements: 100,
    coveredStatements: 80,
    totalConditionals: 10,
    coveredConditionals: 8,
    totalMethods: 10,
    coveredMethods: 8,
    lineRate: 80,
    branchRate: 80,
    files: [
      {
        name: "utils.ts",
        path: "src/utils.ts", // Matches diff path
        statements: 10,
        coveredStatements: 8,
        conditionals: 2,
        coveredConditionals: 1,
        methods: 2,
        coveredMethods: 2,
        lineRate: 80,
        branchRate: 50,
        lines: [
          // Existing lines
          { lineNumber: 10, count: 1, type: "stmt" },
          { lineNumber: 11, count: 1, type: "stmt" },
          // Added subtract function (Covered)
          { lineNumber: 13, count: 1, type: "method" },
          { lineNumber: 14, count: 1, type: "stmt" },
          // Added multiply function (Mixed)
          { lineNumber: 17, count: 1, type: "method" },
          { lineNumber: 18, count: 1, type: "cond" }, // Covered branch
          { lineNumber: 19, count: 0, type: "stmt" }, // Missed line
          { lineNumber: 21, count: 1, type: "stmt" }, // Covered line
        ],
      },
    ],
  };

  it("should calculate patch coverage correctly", () => {
    const result = PatchAnalyzer.analyzePatchCoverage(sampleDiff, mockCoverage);

    // Added lines in diff:
    // 13: export function subtract... (Covered)
    // 14:   return a - b; (Covered)
    // 17: export function multiply... (Covered)
    // 18:   if (a === 0 || b === 0) { (Covered)
    // 19:     return 0; (Missed)
    // 20:   } (Not in coverage map usually, brackets often ignored)
    // 21:   return a * b; (Covered)

    // Total added lines we expect to track: 13, 14, 17, 18, 19, 21
    // Covered: 13, 14, 17, 18, 21 (5 lines)
    // Missed: 19 (1 line)
    // Total: 6 lines

    expect(result.totalLines).toBe(6);
    expect(result.coveredLines).toBe(5);
    expect(result.missedLines).toBe(1);
    expect(result.percentage).toBeCloseTo(83.33, 2); // 5/6 * 100
    expect(result.changedFiles).toEqual(["src/utils.ts"]);
  });

  it("should handle files not present in coverage report", () => {
    const diffWithNewFile = `diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  console.log("world");
+}
+`;

    // Coverage report has no entry for src/new-file.ts
    const result = PatchAnalyzer.analyzePatchCoverage(
      diffWithNewFile,
      mockCoverage,
    );

    expect(result.totalLines).toBe(0);
    expect(result.percentage).toBe(100); // Default when no lines found
    expect(result.changedFiles).toEqual(["src/new-file.ts"]);
    expect(result.unmatchedFiles).toEqual(["src/new-file.ts"]);
  });

  it("should ignore non-executable lines (comments/whitespace) in diff", () => {
    // If the diff adds a line but coverage report doesn't track it, it shouldn't count
    const diffWithComment = `diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,6 +10,7 @@ export function sum(a: number, b: number): number {
+  // This is a comment
   return a + b;
 }
`;

    PatchAnalyzer.analyzePatchCoverage(diffWithComment, mockCoverage);

    // Line 11 added, but not in mockCoverage lines map?
    // Wait, mockCoverage has line 11. Let's adjust mock to NOT have the comment line.
    // In our mock, lines are 10, 11, 13, 14...
    // The diff adds a line at position 11.
    // Git diff lines are tricky. The 'ln' from parse-diff matches the NEW file line numbers.
    // If we insert a line at 11, the old 11 becomes 12.
    // For this test, let's assume we add a line 99 that isn't in coverage.

    const simpleDiff = `diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -98,0 +99,1 @@
+  // Comment line 99
`;

    const result2 = PatchAnalyzer.analyzePatchCoverage(
      simpleDiff,
      mockCoverage,
    );
    expect(result2.totalLines).toBe(0); // Line 99 is not in coverage map, so ignored
  });

  it("should include non-deleted changed files and dedupe duplicate entries", () => {
    const diffWithDeletedAndDuplicate = `diff --git a/src/removed.ts b/src/removed.ts
deleted file mode 100644
index abcdef0..0000000
--- a/src/removed.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-export const removed = true;
-export const deadCode = false;
diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,0 +11,1 @@
+export const fromFirstBlock = true;
diff --git a/src/utils.ts b/src/utils.ts
index bf269f4..c03ff11 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -20,0 +21,1 @@
+export const fromSecondBlock = true;
diff --git a/src/new-file.ts b/src/new-file.ts
new file mode 100644
index 0000000..e69de29
--- /dev/null
+++ b/src/new-file.ts
@@ -0,0 +1 @@
+export const newlyAdded = true;
`;

    const result = PatchAnalyzer.analyzePatchCoverage(
      diffWithDeletedAndDuplicate,
      mockCoverage,
    );

    expect(result.changedFiles).toEqual(["src/utils.ts", "src/new-file.ts"]);
    expect(result.changedFiles).not.toContain("src/removed.ts");
  });

  it("should match absolute coverage paths against relative diff paths via suffix", () => {
    // Coverage data has absolute paths (e.g. from cargo llvm-cov),
    // diff has repo-relative paths
    const absolutePathCoverage: AggregatedCoverageResults = {
      totalStatements: 100,
      coveredStatements: 80,
      totalConditionals: 10,
      coveredConditionals: 8,
      totalMethods: 10,
      coveredMethods: 8,
      lineRate: 80,
      branchRate: 80,
      files: [
        {
          name: "utils.ts",
          path: "/home/runner/work/repo/repo/src/utils.ts",
          statements: 10,
          coveredStatements: 8,
          conditionals: 2,
          coveredConditionals: 1,
          methods: 2,
          coveredMethods: 2,
          lineRate: 80,
          branchRate: 50,
          lines: [
            { lineNumber: 10, count: 1, type: "stmt" },
            { lineNumber: 11, count: 1, type: "stmt" },
            { lineNumber: 13, count: 1, type: "method" },
            { lineNumber: 14, count: 1, type: "stmt" },
            { lineNumber: 17, count: 1, type: "method" },
            { lineNumber: 18, count: 1, type: "cond" },
            { lineNumber: 19, count: 0, type: "stmt" },
            { lineNumber: 21, count: 1, type: "stmt" },
          ],
        },
      ],
    };

    const result = PatchAnalyzer.analyzePatchCoverage(
      sampleDiff,
      absolutePathCoverage,
    );

    // Should match via suffix and produce the same results as exact match
    expect(result.totalLines).toBe(6);
    expect(result.coveredLines).toBe(5);
    expect(result.missedLines).toBe(1);
    expect(result.percentage).toBeCloseTo(83.33, 2);
    expect(result.unmatchedFiles).toEqual([]);
  });

  it("should track unmatched files when no coverage paths match", () => {
    const noMatchCoverage: AggregatedCoverageResults = {
      totalStatements: 50,
      coveredStatements: 40,
      totalConditionals: 5,
      coveredConditionals: 4,
      totalMethods: 5,
      coveredMethods: 4,
      lineRate: 80,
      branchRate: 80,
      files: [
        {
          name: "other.ts",
          path: "src/other.ts",
          statements: 50,
          coveredStatements: 40,
          conditionals: 5,
          coveredConditionals: 4,
          methods: 5,
          coveredMethods: 4,
          lineRate: 80,
          branchRate: 80,
          lines: [{ lineNumber: 1, count: 1, type: "stmt" }],
        },
      ],
    };

    const result = PatchAnalyzer.analyzePatchCoverage(
      sampleDiff,
      noMatchCoverage,
    );

    expect(result.totalLines).toBe(0);
    expect(result.percentage).toBe(100);
    expect(result.unmatchedFiles).toEqual(["src/utils.ts"]);
  });

  it("should return empty unmatchedFiles when all files match", () => {
    const result = PatchAnalyzer.analyzePatchCoverage(sampleDiff, mockCoverage);

    expect(result.unmatchedFiles).toEqual([]);
  });

  it("should track partialLines in file breakdown from file coverage partialLines", () => {
    const coverageWithPartials: AggregatedCoverageResults = {
      totalStatements: 100,
      coveredStatements: 80,
      totalConditionals: 10,
      coveredConditionals: 8,
      totalMethods: 10,
      coveredMethods: 8,
      lineRate: 80,
      branchRate: 80,
      files: [
        {
          name: "utils.ts",
          path: "src/utils.ts",
          statements: 10,
          coveredStatements: 8,
          conditionals: 2,
          coveredConditionals: 1,
          methods: 2,
          coveredMethods: 2,
          lineRate: 80,
          branchRate: 50,
          lines: [
            { lineNumber: 13, count: 1, type: "method" },
            { lineNumber: 14, count: 1, type: "stmt" },
            { lineNumber: 17, count: 1, type: "method" },
            { lineNumber: 18, count: 1, type: "cond" },
            { lineNumber: 19, count: 0, type: "stmt" },
            { lineNumber: 21, count: 1, type: "stmt" },
          ],
          // Line 18 has partial branch coverage
          partialLines: [18],
        },
      ],
    };

    const result = PatchAnalyzer.analyzePatchCoverage(
      sampleDiff,
      coverageWithPartials,
    );

    // Line 18 is covered (count > 0) but is also in partialLines
    expect(result.fileBreakdown).toHaveLength(1);
    const file = result.fileBreakdown[0];
    expect(file.path).toBe("src/utils.ts");
    expect(file.missedLines).toEqual([19]);
    expect(file.partialLines).toEqual([18]);
    // Covered: 13, 14, 17, 18, 21 = 5; Missed: 19 = 1
    expect(file.coveredLines).toEqual([13, 14, 17, 18, 21]);
  });

  it("should return empty partialLines when file has no partial coverage", () => {
    const result = PatchAnalyzer.analyzePatchCoverage(sampleDiff, mockCoverage);

    expect(result.fileBreakdown).toHaveLength(1);
    expect(result.fileBreakdown[0].partialLines).toEqual([]);
  });

  it("should not count zero-hit comment lines (JSDoc, //, #) as missed", () => {
    // Simulates bun emitting DA:x,0 for JSDoc and comment lines in CI
    // due to source-map artifacts from TypeScript compilation.
    const diffWithComments = `diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,0 +11,7 @@
+ * JSDoc continuation line
+// single-line comment
+# shell-style comment
+/**
+ */
+  return 42;
+
`;

    const coverageWithCommentZeros: AggregatedCoverageResults = {
      ...mockCoverage,
      files: [
        {
          ...mockCoverage.files[0],
          lines: [
            { lineNumber: 11, count: 0 }, // * JSDoc — zero-hit DA artifact
            { lineNumber: 12, count: 0 }, // // comment — zero-hit DA artifact
            { lineNumber: 13, count: 0 }, // # comment — zero-hit DA artifact
            { lineNumber: 14, count: 0 }, // /** opener — zero-hit DA artifact
            { lineNumber: 15, count: 0 }, // */ closer — zero-hit DA artifact
            { lineNumber: 16, count: 5 }, // return 42 — actually executed
            // line 17 is blank, no DA entry
          ],
        },
      ],
    };

    const result = PatchAnalyzer.analyzePatchCoverage(
      diffWithComments,
      coverageWithCommentZeros,
    );

    // Comment lines with DA:x,0 must not count as missed
    expect(result.missedLines).toBe(0);
    // The one real code line with hits must count as covered
    expect(result.coveredLines).toBe(1);
    expect(result.percentage).toBe(100);
  });

  it("should count JS/TS private class members (#field) as executable, not comments", () => {
    // Private class fields start with # but are NOT comments.
    // A DA:x,0 entry for #privateField must count as missed coverage.
    const diffWithPrivateField = `diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,0 +11,2 @@
+  #count = 0;
+  #_backing = null;
`;

    const coverageWithPrivateZero: AggregatedCoverageResults = {
      ...mockCoverage,
      files: [
        {
          ...mockCoverage.files[0],
          lines: [
            { lineNumber: 11, count: 0 }, // #count — unexecuted private field
            { lineNumber: 12, count: 0 }, // #_backing — unexecuted private field
          ],
        },
      ],
    };

    const result = PatchAnalyzer.analyzePatchCoverage(
      diffWithPrivateField,
      coverageWithPrivateZero,
    );

    // Private fields are executable — zero-hit DA entries must count as missed
    expect(result.missedLines).toBe(2);
    expect(result.coveredLines).toBe(0);
  });

  it("should count JS/TS generator methods (*name, *[Symbol]) as executable, not comments", () => {
    // Bun emits DA:x,0 for generator method declaration lines when the method
    // is never called. startsWith("*") would silently skip these, hiding a real
    // coverage gap. Confirmed by actual bun LCOV output: *range(n) { → DA:4,0.
    const diffWithGenerator = `diff --git a/src/utils.ts b/src/utils.ts
index 83db48f..bf269f4 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -10,0 +11,5 @@
+  *range(n: number) {
+    for (let i = 0; i < n; i++) { yield i; }
+  }
+  *[Symbol.iterator]() { yield 0; }
+  *(computed)() { return 1; }
`;

    const coverageWithGeneratorZero: AggregatedCoverageResults = {
      ...mockCoverage,
      files: [
        {
          ...mockCoverage.files[0],
          lines: [
            { lineNumber: 11, count: 0 }, // *range — bun DA:x,0 for uncalled generator
            { lineNumber: 12, count: 0 }, // for loop body — uncalled
            { lineNumber: 14, count: 0 }, // *[Symbol.iterator] — uncalled
            { lineNumber: 15, count: 0 }, // *(computed) — parenthesised computed generator
          ],
        },
      ],
    };

    const result = PatchAnalyzer.analyzePatchCoverage(
      diffWithGenerator,
      coverageWithGeneratorZero,
    );

    // Generator methods are executable — zero-hit DA entries must count as missed
    expect(result.missedLines).toBe(4);
    expect(result.coveredLines).toBe(0);
  });
});
