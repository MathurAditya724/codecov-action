import * as core from "@actions/core";
import parseDiff from "parse-diff";
import type {
  AggregatedCoverageResults,
  FileCoverage,
} from "../types/coverage.js";

export interface PatchCoverageResults {
  coveredLines: number;
  missedLines: number;
  totalLines: number;
  percentage: number;
  fileBreakdown: PatchFileCoverage[];
  changedFiles: string[];
  unmatchedFiles: string[];
}

export interface PatchFileCoverage {
  path: string;
  coveredLines: number[];
  missedLines: number[];
  partialLines: number[];
  percentage: number;
}

/**
 * Returns true when a diff line's content is purely a comment or blank —
 * these lines are never executable regardless of what the LCOV says.
 *
 * Coverage tools (e.g. bun under --isolate) sometimes emit DA:x,0 entries
 * for JSDoc continuation lines and other comment lines due to source-map
 * artifacts. Counting those as "missed" is a false positive.
 *
 * @param diffLine - raw diff line content including the leading "+" character
 */
function isCommentOrBlankLine(diffLine: string): boolean {
  // Strip the leading "+" diff marker and any indentation
  const content = diffLine.slice(1).trimStart();
  return (
    content === "" ||
    content.startsWith("//") || // single-line JS/TS/Java comment
    content.startsWith("/*") || // block/JSDoc comment opener: /*, /**
    content.startsWith("*") || // block/JSDoc continuation or closer: * text, */
    /^#(?!\w)/u.test(content) // shell/Python comment; excludes JS/TS private fields (#field)
  );
}

/**
 * Normalize a file path by stripping leading "./" and normalizing slashes.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.?\//, "");
}

/**
 * Find a coverage file matching a diff path, using exact match first,
 * then falling back to suffix-based matching for absolute vs relative
 * path mismatches (e.g. coverage has /home/runner/work/repo/repo/src/file.ts
 * while diff has src/file.ts).
 *
 * Results are cached in resolvedPaths so the O(n) suffix scan only happens once
 * per diff file path.
 */
function findCoverageFile(
  diffPath: string,
  coverageMap: Map<string, FileCoverage>,
  resolvedPaths: Map<string, FileCoverage | null>,
): FileCoverage | null {
  // Check cache first
  if (resolvedPaths.has(diffPath)) {
    return resolvedPaths.get(diffPath) ?? null;
  }

  // 1. Exact match
  const exact = coverageMap.get(diffPath);
  if (exact) {
    resolvedPaths.set(diffPath, exact);
    return exact;
  }

  const normalizedDiff = normalizePath(diffPath);

  // 2. Normalized equality: handles cases like "/src/file.ts" vs "src/file.ts"
  //    where the raw strings differ but normalize to the same path.
  for (const [coveragePath, file] of coverageMap) {
    if (normalizePath(coveragePath) === normalizedDiff) {
      resolvedPaths.set(diffPath, file);
      return file;
    }
  }

  // 3. Suffix match: coverage path ends with the diff path
  //    e.g. "/home/runner/work/repo/repo/src/file.ts" ends with "/src/file.ts"
  for (const [coveragePath, file] of coverageMap) {
    const normalizedCoverage = normalizePath(coveragePath);

    if (
      normalizedCoverage.endsWith(`/${normalizedDiff}`) ||
      normalizedDiff.endsWith(`/${normalizedCoverage}`)
    ) {
      core.info(
        `  Matched diff path '${diffPath}' to coverage path '${coveragePath}' via suffix match`,
      );
      resolvedPaths.set(diffPath, file);
      return file;
    }
  }

  // No match found
  resolvedPaths.set(diffPath, null);
  return null;
}

export const PatchAnalyzer = {
  /**
   * Calculate patch coverage by intersecting coverage results with git diff
   */
  analyzePatchCoverage(
    diffContent: string,
    coverageResults: AggregatedCoverageResults,
  ): PatchCoverageResults {
    const diffFiles = parseDiff(diffContent);
    const fileBreakdown: PatchFileCoverage[] = [];
    const changedFiles = new Set<string>();
    const unmatchedFiles: string[] = [];

    let totalCovered = 0;
    let totalMissed = 0;

    // Create a map of file paths from coverage results for lookup
    const coverageMap = new Map(
      coverageResults.files.map((file) => [file.path, file]),
    );

    // Cache for resolved diff-path -> coverage-file mappings
    const resolvedPaths = new Map<string, FileCoverage | null>();

    for (const diffFile of diffFiles) {
      // Skip files that were deleted or have no changes
      if (diffFile.deleted || !diffFile.to) {
        continue;
      }
      changedFiles.add(diffFile.to);

      // Try to find matching coverage file (exact match, then suffix match)
      const coverageFile = findCoverageFile(
        diffFile.to,
        coverageMap,
        resolvedPaths,
      );

      if (!coverageFile) {
        unmatchedFiles.push(diffFile.to);
        continue;
      }

      const coveredLines: number[] = [];
      const missedLines: number[] = [];
      const partialLines: number[] = [];

      // Build a line number map for O(1) lookups instead of O(n) find() per line
      const lineMap = new Map(coverageFile.lines.map((l) => [l.lineNumber, l]));

      // Build a set of partial lines from file coverage for quick lookup
      const filePartialSet = new Set(coverageFile.partialLines ?? []);

      // Iterate through chunks and changes
      for (const chunk of diffFile.chunks) {
        for (const change of chunk.changes) {
          // We only care about added lines
          if (change.type === "add") {
            const lineNumber = change.ln;

            // Check if this line exists in coverage data
            const lineCoverage = lineMap.get(lineNumber);

            // If line exists in coverage data (meaning it's executable code, not comment/whitespace)
            if (lineCoverage) {
              if (lineCoverage.count === 0) {
                // Skip comment/blank lines — zero-hit DA entries for these are
                // source-map artifacts from tools like bun, not real coverage gaps.
                if (isCommentOrBlankLine(change.content)) continue;
                missedLines.push(lineNumber);
                totalMissed++;
              } else {
                coveredLines.push(lineNumber);
                totalCovered++;
                // Check if this covered line has partial branch coverage
                if (filePartialSet.has(lineNumber)) {
                  partialLines.push(lineNumber);
                }
              }
            }
          }
        }
      }

      // Only add to breakdown if there were executable lines in the patch
      if (
        coveredLines.length > 0 ||
        missedLines.length > 0 ||
        partialLines.length > 0
      ) {
        const total = coveredLines.length + missedLines.length;
        fileBreakdown.push({
          path: diffFile.to,
          coveredLines,
          missedLines,
          partialLines,
          percentage: total === 0 ? 100 : (coveredLines.length / total) * 100,
        });

        // Enrich the original file coverage object with patch info if needed
        // (optional, but good for consistent data model)
        coverageFile.missingLines = [...(coverageFile.missingLines || [])]; // Keep existing missing lines
      }
    }

    const totalLines = totalCovered + totalMissed;
    const percentage =
      totalLines === 0 ? 100 : (totalCovered / totalLines) * 100;

    // Warn when no changed files could be matched to coverage data
    if (unmatchedFiles.length > 0 && totalLines === 0) {
      const sampleCoveragePaths = coverageResults.files
        .slice(0, 3)
        .map((f) => f.path);
      core.warning(
        `Patch coverage defaulted to 100% because no changed files matched coverage data.\n` +
          `  Unmatched diff files: ${unmatchedFiles.join(", ")}\n` +
          `  Sample coverage paths: ${sampleCoveragePaths.join(", ")}\n` +
          `  This usually indicates a path format mismatch between your coverage tool and the repository.`,
      );
    } else if (unmatchedFiles.length > 0) {
      core.info(
        `  Some changed files had no coverage data: ${unmatchedFiles.join(", ")}`,
      );
    }

    core.info(`Patch Coverage Analysis:`);
    core.info(`  Covered Lines: ${totalCovered}`);
    core.info(`  Missed Lines: ${totalMissed}`);
    core.info(`  Percentage: ${percentage.toFixed(2)}%`);

    return {
      coveredLines: totalCovered,
      missedLines: totalMissed,
      totalLines,
      percentage,
      fileBreakdown,
      changedFiles: [...changedFiles],
      unmatchedFiles,
    };
  },
};
