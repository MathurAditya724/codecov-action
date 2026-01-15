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
      mockCoverage
    );

    expect(result.totalLines).toBe(0);
    expect(result.percentage).toBe(100); // Default when no lines found
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
    
    const result = PatchAnalyzer.analyzePatchCoverage(
      diffWithComment,
      mockCoverage
    );

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

    const result2 = PatchAnalyzer.analyzePatchCoverage(simpleDiff, mockCoverage);
    expect(result2.totalLines).toBe(0); // Line 99 is not in coverage map, so ignored
  });
});
