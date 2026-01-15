import type { NormalizedConfig } from "../types/config.js";
import type { AggregatedCoverageResults } from "../types/coverage.js";

export interface StatusCheckResult {
  status: "success" | "failure";
  description: string;
}

export class ThresholdChecker {
  /**
   * Check project coverage status against configured thresholds
   */
  static checkProjectStatus(
    results: AggregatedCoverageResults,
    config: NormalizedConfig["status"]["project"]
  ): StatusCheckResult {
    const { target, threshold } = config;
    const currentCoverage = results.lineRate;

    // Target: number (absolute percentage)
    if (typeof target === "number") {
      const isSuccess = currentCoverage >= target;
      const status = isSuccess ? "success" : "failure";
      const description = `${currentCoverage.toFixed(
        2
      )}% ${isSuccess ? ">=" : "<"} target ${target}%`;
      return { status, description };
    }

    // Target: "auto" (relative to base branch)
    if (target === "auto") {
      // If no comparison data, we can't enforce "auto", so we default to success (informational)
      if (!results.comparison) {
        return {
          status: "success",
          description: `${currentCoverage.toFixed(2)}% (No base report)`,
        };
      }

      const baseCoverage = results.comparison.baseLineRate;
      const delta = results.comparison.deltaLineRate;
      const allowedDrop = threshold || 0; // Default 0% drop allowed
      
      // If allowedDrop is 1%, then new coverage must be >= base - 1
      // Equivalent to: delta >= -allowedDrop
      const isSuccess = delta >= -allowedDrop;
      
      const status = isSuccess ? "success" : "failure";
      
      let description = "";
      if (delta >= 0) {
        description = `${currentCoverage.toFixed(2)}% (+${delta.toFixed(2)}%) relative to base`;
      } else {
        description = `${currentCoverage.toFixed(2)}% (${delta.toFixed(2)}%) relative to base`;
        if (allowedDrop > 0) {
           description += ` (threshold ${allowedDrop}%)`;
        }
      }

      return { status, description };
    }

    return { status: "success", description: "Unknown target configuration" };
  }

  /**
   * Check patch coverage status against configured thresholds
   * Note: Patch coverage calculation is not yet implemented, so this uses a placeholder
   */
  static checkPatchStatus(
    results: AggregatedCoverageResults,
    config: NormalizedConfig["status"]["patch"]
  ): StatusCheckResult {
    // Stub for future patch coverage implementation
    // For now, if we don't have patch coverage data, we skip this check
    return {
      status: "success",
      description: "Patch coverage check not yet implemented",
    };
  }
}
