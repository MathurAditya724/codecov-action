import type { NormalizedConfig } from "../types/config.js";
import type { AggregatedCoverageResults } from "../types/coverage.js";
import type { PatchCoverageResults } from "./patch-analyzer.js";

export interface StatusCheckResult {
  status: "success" | "failure";
  description: string;
}

export interface PatchConfig {
  target: number | "auto";
  threshold: number | null;
}

export const ThresholdChecker = {
  /**
   * Check project coverage status against configured thresholds
   */
  checkProjectStatus(
    results: AggregatedCoverageResults,
    config: NormalizedConfig["status"]["project"]
  ): StatusCheckResult {
    const { target, threshold } = config;
    const currentCoverage = results.lineRate;

    // Target: number (absolute percentage)
    if (typeof target === "number") {
      const isSuccess = currentCoverage >= target;
      const status = isSuccess ? "success" : "failure";
      const description = `${currentCoverage.toFixed(2)}% ${
        isSuccess ? ">=" : "<"
      } target ${target}%`;
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

      const delta = results.comparison.deltaLineRate;
      const allowedDrop = threshold || 0; // Default 0% drop allowed

      // If allowedDrop is 1%, then new coverage must be >= base - 1
      // Equivalent to: delta >= -allowedDrop
      const isSuccess = delta >= -allowedDrop;

      const status = isSuccess ? "success" : "failure";

      let description = "";
      if (delta >= 0) {
        description = `${currentCoverage.toFixed(2)}% (+${delta.toFixed(
          2
        )}%) relative to base`;
      } else {
        description = `${currentCoverage.toFixed(2)}% (${delta.toFixed(
          2
        )}%) relative to base`;
        if (allowedDrop > 0) {
          description += ` (threshold ${allowedDrop}%)`;
        }
      }

      return { status, description };
    }

    return { status: "success", description: "Unknown target configuration" };
  },

  /**
   * Check patch coverage status against configured thresholds
   */
  checkPatchStatus(
    patchCoverage: PatchCoverageResults | null,
    config: PatchConfig
  ): StatusCheckResult {
    // If no patch coverage data available (not in PR context or calculation failed)
    if (!patchCoverage) {
      return {
        status: "success",
        description: "Patch coverage: N/A (not in PR context)",
      };
    }

    // Default target to 80% if set to "auto"
    const target = typeof config.target === "number" ? config.target : 80;
    const isSuccess = patchCoverage.percentage >= target;

    return {
      status: isSuccess ? "success" : "failure",
      description: `${patchCoverage.percentage.toFixed(2)}% ${
        isSuccess ? ">=" : "<"
      } target ${target}%`,
    };
  },
};
