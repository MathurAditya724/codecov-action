import type { NormalizedConfig } from "../types/config.js";
import type { AggregatedCoverageResults } from "../types/coverage.js";
import type { PatchCoverageResults } from "./patch-analyzer.js";

export interface StatusCheckResult {
  status: "success" | "failure";
  description: string;
  informational: boolean; // When true, failure is advisory-only and should not fail the build
}

export interface PatchConfig {
  target: number | "auto";
  threshold: number | null;
  informational: boolean;
}

export const ThresholdChecker = {
  /**
   * Check project coverage status against configured thresholds
   */
  checkProjectStatus(
    results: AggregatedCoverageResults,
    config: NormalizedConfig["status"]["project"],
  ): StatusCheckResult {
    const { target, threshold, informational } = config;
    const currentCoverage = results.lineRate;

    // Target: number (absolute percentage)
    if (typeof target === "number") {
      const isSuccess = currentCoverage >= target;
      const status = isSuccess ? "success" : "failure";
      const description = `${currentCoverage.toFixed(2)}% ${
        isSuccess ? ">=" : "<"
      } target ${target}%`;
      return { status, description, informational };
    }

    // Target: "auto" (relative to base branch)
    if (target === "auto") {
      // If no comparison data, we can't enforce "auto", so we default to success (informational)
      if (!results.comparison) {
        return {
          status: "success",
          description: `${currentCoverage.toFixed(2)}% (No base report)`,
          informational,
        };
      }

      const delta = results.comparison.deltaLineRate;
      const allowedDrop = threshold || 0; // Default 0% drop allowed

      // If allowedDrop is 1%, then new coverage must be >= base - 1
      // Equivalent to: delta >= -allowedDrop
      // Add epsilon tolerance (half a rounding step at 2dp) to absorb
      // floating-point noise from coverage rate calculations.
      const EPSILON = 0.005;
      const isSuccess = delta >= -(allowedDrop + EPSILON);

      const status = isSuccess ? "success" : "failure";

      let description = "";
      if (delta >= 0) {
        description = `${currentCoverage.toFixed(2)}% (+${delta.toFixed(
          2,
        )}%) relative to base`;
      } else {
        description = `${currentCoverage.toFixed(2)}% (${delta.toFixed(
          2,
        )}%) relative to base`;
        if (allowedDrop > 0) {
          description += ` (threshold ${allowedDrop}%)`;
        }
      }

      return { status, description, informational };
    }

    return {
      status: "success",
      description: "Unknown target configuration",
      informational,
    };
  },

  /**
   * Check patch coverage status against configured thresholds
   */
  checkPatchStatus(
    patchCoverage: PatchCoverageResults | null,
    config: PatchConfig,
  ): StatusCheckResult {
    const { informational } = config;

    // If no patch coverage data available (not in PR context or calculation failed)
    if (!patchCoverage) {
      return {
        status: "success",
        description: "Patch coverage: N/A (not in PR context)",
        informational,
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
      informational,
    };
  },
};
