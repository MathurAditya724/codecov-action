import { describe, expect, it } from "vitest";
import { ThresholdChecker } from "../analyzers/threshold-checker.js";
import type { AggregatedCoverageResults } from "../types/coverage.js";

describe("ThresholdChecker", () => {
  const mockResults = {
    lineRate: 80,
    comparison: {
      baseLineRate: 75,
      deltaLineRate: 5,
    },
  } as AggregatedCoverageResults;

  describe("checkProjectStatus", () => {
    it("should pass when coverage exceeds target", () => {
      const config = { target: 70, threshold: null };
      const result = ThresholdChecker.checkProjectStatus(mockResults, config);
      expect(result.status).toBe("success");
      expect(result.description).toContain(">= target 70%");
    });

    it("should fail when coverage is below target", () => {
      const config = { target: 90, threshold: null };
      const result = ThresholdChecker.checkProjectStatus(mockResults, config);
      expect(result.status).toBe("failure");
      expect(result.description).toContain("< target 90%");
    });

    it("should pass auto target when coverage improves", () => {
      const config = { target: "auto" as const, threshold: 0 };
      // delta +5 > -0
      const result = ThresholdChecker.checkProjectStatus(mockResults, config);
      expect(result.status).toBe("success");
      expect(result.description).toContain("(+5.00%) relative to base");
    });

    it("should pass auto target when drop is within threshold", () => {
      const dropResults = {
        lineRate: 79,
        comparison: {
          baseLineRate: 80,
          deltaLineRate: -1,
        },
      } as AggregatedCoverageResults;

      const config = { target: "auto" as const, threshold: 5 };
      // delta -1 >= -5
      const result = ThresholdChecker.checkProjectStatus(dropResults, config);
      expect(result.status).toBe("success");
      expect(result.description).toContain("(-1.00%) relative to base (threshold 5%)");
    });

    it("should fail auto target when drop exceeds threshold", () => {
      const dropResults = {
        lineRate: 70,
        comparison: {
          baseLineRate: 80,
          deltaLineRate: -10,
        },
      } as AggregatedCoverageResults;

      const config = { target: "auto" as const, threshold: 5 };
      // delta -10 < -5
      const result = ThresholdChecker.checkProjectStatus(dropResults, config);
      expect(result.status).toBe("failure");
    });
  });
});
