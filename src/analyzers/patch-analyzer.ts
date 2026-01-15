import * as core from "@actions/core";
import parseDiff from "parse-diff";
import type { AggregatedCoverageResults } from "../types/coverage.js";

export interface PatchCoverageResults {
  coveredLines: number;
  missedLines: number;
  totalLines: number;
  percentage: number;
  fileBreakdown: PatchFileCoverage[];
}

export interface PatchFileCoverage {
  path: string;
  coveredLines: number[];
  missedLines: number[];
  percentage: number;
}

export const PatchAnalyzer = {
  /**
   * Calculate patch coverage by intersecting coverage results with git diff
   */
  analyzePatchCoverage(
    diffContent: string,
    coverageResults: AggregatedCoverageResults
  ): PatchCoverageResults {
    const diffFiles = parseDiff(diffContent);
    const fileBreakdown: PatchFileCoverage[] = [];

    let totalCovered = 0;
    let totalMissed = 0;

    // Create a map of normalized file paths from coverage results for faster lookup
    // Normalize by ensuring paths start with relative root logic if needed,
    // but usually coverage paths are repo-relative (e.g. src/index.ts)
    const coverageMap = new Map(
      coverageResults.files.map((file) => [file.path, file])
    );

    for (const diffFile of diffFiles) {
      // Skip files that were deleted or have no changes
      if (diffFile.deleted || !diffFile.to) {
        continue;
      }

      // Try to find matching coverage file
      // Diff paths usually strictly relative, coverage paths might vary
      // Simple exact match first
      const coverageFile = coverageMap.get(diffFile.to);

      // If not found, try to be more fuzzy if needed, but exact match is safest for now
      // Assuming coverage paths are normalized to repo root
      if (!coverageFile) {
        continue;
      }

      const coveredLines: number[] = [];
      const missedLines: number[] = [];

      // Iterate through chunks and changes
      for (const chunk of diffFile.chunks) {
        for (const change of chunk.changes) {
          // We only care about added lines
          if (change.type === "add") {
            const lineNumber = change.ln;

            // Check if this line exists in coverage data
            const lineCoverage = coverageFile.lines.find(
              (l) => l.lineNumber === lineNumber
            );

            // If line exists in coverage data (meaning it's executable code, not comment/whitespace)
            if (lineCoverage) {
              if (lineCoverage.count > 0) {
                coveredLines.push(lineNumber);
                totalCovered++;
              } else {
                missedLines.push(lineNumber);
                totalMissed++;
              }
            }
          }
        }
      }

      // Only add to breakdown if there were executable lines in the patch
      if (coveredLines.length > 0 || missedLines.length > 0) {
        const total = coveredLines.length + missedLines.length;
        fileBreakdown.push({
          path: diffFile.to,
          coveredLines,
          missedLines,
          percentage: total === 0 ? 100 : (coveredLines.length / total) * 100,
        });

        // Enrich the original file coverage object with patch info if needed
        // (optional, but good for consistent data model)
        coverageFile.missingLines = [...(coverageFile.missingLines || [])]; // Keep existing missing lines
        // We could add specific patch missing lines here if we wanted to track them separately
      }
    }

    const totalLines = totalCovered + totalMissed;
    const percentage =
      totalLines === 0 ? 100 : (totalCovered / totalLines) * 100;

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
    };
  },
};
