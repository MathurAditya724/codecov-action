import type {
  AggregatedCoverageResults,
  CoverageComparison,
  FileComparison,
  FileCoverage,
} from "../types/coverage.js";

/**
 * Compare options for additional metadata
 */
export interface CompareOptions {
  baseBranch?: string;
  headCommit?: string;
  baseCommit?: string;
}

/**
 * Compare coverage for a single file
 */
function compareFiles(
  baseFile: FileCoverage,
  currentFile: FileCoverage
): FileComparison {
  return {
    name: currentFile.name,
    path: currentFile.path,
    baseLineRate: baseFile.lineRate,
    currentLineRate: currentFile.lineRate,
    baseBranchRate: baseFile.branchRate,
    currentBranchRate: currentFile.branchRate,
    deltaLineRate: Number.parseFloat(
      (currentFile.lineRate - baseFile.lineRate).toFixed(2)
    ),
    deltaBranchRate: Number.parseFloat(
      (currentFile.branchRate - baseFile.branchRate).toFixed(2)
    ),
    deltaStatements: currentFile.statements - baseFile.statements,
    deltaCoveredStatements:
      currentFile.coveredStatements - baseFile.coveredStatements,
    deltaConditionals: currentFile.conditionals - baseFile.conditionals,
    deltaCoveredConditionals:
      currentFile.coveredConditionals - baseFile.coveredConditionals,
    missingLines: currentFile.missingLines?.length || 0,
    partialLines: currentFile.partialLines?.length || 0,
  };
}

/**
 * Compares coverage results between base and current branches
 */
export const CoverageComparator = {
  /**
   * Compare coverage results from base branch to current branch
   */
  compareResults(
    baseResults: AggregatedCoverageResults,
    currentResults: AggregatedCoverageResults,
    options?: CompareOptions
  ): CoverageComparison {
    // Build file maps for easy lookup
    const baseFileMap = new Map<string, FileCoverage>();
    const currentFileMap = new Map<string, FileCoverage>();

    for (const file of baseResults.files) {
      baseFileMap.set(file.path, file);
    }

    for (const file of currentResults.files) {
      currentFileMap.set(file.path, file);
    }

    // Find added, removed, and changed files
    const filesAdded: FileCoverage[] = [];
    const filesRemoved: FileCoverage[] = [];
    const filesChanged: FileComparison[] = [];

    // Check for added and changed files
    for (const [path, currentFile] of currentFileMap) {
      const baseFile = baseFileMap.get(path);

      if (!baseFile) {
        // File was added
        filesAdded.push(currentFile);
      } else {
        // File exists in both - compare coverage
        const comparison = compareFiles(baseFile, currentFile);
        if (
          comparison.deltaLineRate !== 0 ||
          comparison.deltaBranchRate !== 0
        ) {
          filesChanged.push(comparison);
        }
      }
    }

    // Check for removed files
    for (const [path, baseFile] of baseFileMap) {
      if (!currentFileMap.has(path)) {
        filesRemoved.push(baseFile);
      }
    }

    // Calculate deltas
    const deltaLineRate = Number.parseFloat(
      (currentResults.lineRate - baseResults.lineRate).toFixed(2)
    );
    const deltaBranchRate = Number.parseFloat(
      (currentResults.branchRate - baseResults.branchRate).toFixed(2)
    );
    const deltaTotalStatements =
      currentResults.totalStatements - baseResults.totalStatements;
    const deltaCoveredStatements =
      currentResults.coveredStatements - baseResults.coveredStatements;
    const deltaTotalConditionals =
      currentResults.totalConditionals - baseResults.totalConditionals;
    const deltaCoveredConditionals =
      currentResults.coveredConditionals - baseResults.coveredConditionals;
    const deltaTotalMethods =
      currentResults.totalMethods - baseResults.totalMethods;
    const deltaCoveredMethods =
      currentResults.coveredMethods - baseResults.coveredMethods;

    // Calculate detailed delta metrics
    const deltaFiles =
      (currentResults.totalFiles || currentResults.files.length) -
      (baseResults.totalFiles || baseResults.files.length);
    const deltaLines =
      (currentResults.totalLines || 0) - (baseResults.totalLines || 0);
    const deltaBranches =
      (currentResults.totalBranches || 0) - (baseResults.totalBranches || 0);
    const deltaHits =
      (currentResults.totalHits || 0) - (baseResults.totalHits || 0);
    const deltaMisses =
      (currentResults.totalMisses || 0) - (baseResults.totalMisses || 0);
    const deltaPartials =
      (currentResults.totalPartials || 0) - (baseResults.totalPartials || 0);

    // Determine if overall coverage improved
    const improvement =
      deltaLineRate > 0 || (deltaLineRate === 0 && deltaBranchRate > 0);

    return {
      filesAdded,
      filesRemoved,
      filesChanged,
      deltaLineRate,
      deltaBranchRate,
      deltaTotalStatements,
      deltaCoveredStatements,
      deltaTotalConditionals,
      deltaCoveredConditionals,
      deltaTotalMethods,
      deltaCoveredMethods,
      improvement,
      // Detailed comparison metrics
      deltaFiles,
      deltaLines,
      deltaBranches,
      deltaHits,
      deltaMisses,
      deltaPartials,
      // Reference info
      baseBranch: options?.baseBranch,
      headCommit: options?.headCommit,
      baseCommit: options?.baseCommit,
      // Base metrics for diff table
      baseFiles: baseResults.totalFiles || baseResults.files.length,
      baseLines: baseResults.totalLines || 0,
      baseBranches: baseResults.totalBranches || 0,
      baseHits: baseResults.totalHits || 0,
      baseMisses: baseResults.totalMisses || 0,
      basePartials: baseResults.totalPartials || 0,
      // Current metrics for diff table
      currentFiles: currentResults.totalFiles || currentResults.files.length,
      currentLines: currentResults.totalLines || 0,
      currentBranches: currentResults.totalBranches || 0,
      currentHits: currentResults.totalHits || 0,
      currentMisses: currentResults.totalMisses || 0,
      currentPartials: currentResults.totalPartials || 0,
    };
  },
  /**
   * Get a summary of coverage changes for display
   */
  getSummary(comparison: CoverageComparison): string {
    const parts: string[] = [];

    if (comparison.improvement) {
      parts.push("📈 Coverage improved!");
    } else if (comparison.deltaLineRate < 0 || comparison.deltaBranchRate < 0) {
      parts.push("📉 Coverage decreased");
    } else {
      parts.push("➡️ Coverage unchanged");
    }

    parts.push(
      `Line: ${comparison.deltaLineRate >= 0 ? "+" : ""}${
        comparison.deltaLineRate
      }%`
    );
    parts.push(
      `Branch: ${comparison.deltaBranchRate >= 0 ? "+" : ""}${
        comparison.deltaBranchRate
      }%`
    );

    if (comparison.filesAdded.length > 0) {
      parts.push(`+${comparison.filesAdded.length} files`);
    }

    if (comparison.filesRemoved.length > 0) {
      parts.push(`-${comparison.filesRemoved.length} files`);
    }

    return parts.join(" | ");
  },
};
