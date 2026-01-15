/**
 * Configuration types for the action
 */

/**
 * Coverage status configuration (project/patch)
 */
export interface CoverageStatusConfig {
  target: number | "auto"; // Target coverage percentage (or "auto" to use base branch)
  threshold: number | null; // Allowed drop in coverage percentage
}

/**
 * Root configuration interface for .github/coverage.yml
 */
export interface CodecovConfig {
  coverage?: {
    status?: {
      project?: CoverageStatusConfig; // Overall project coverage settings
      patch?: CoverageStatusConfig; // Patch (diff) coverage settings
    };
    ignore?: string[]; // Glob patterns to ignore
  };
}

/**
 * Normalized configuration used internally by the action
 */
export interface NormalizedConfig {
  status: {
    project: {
      target: number | "auto";
      threshold: number | null;
    };
    patch: {
      target: number;
      threshold: number | null;
    };
  };
  ignore: string[];
}
