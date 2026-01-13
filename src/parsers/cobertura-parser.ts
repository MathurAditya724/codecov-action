import { parseStringPromise } from "xml2js";
import type {
  CoverageMetrics,
  CoverageResults,
  FileCoverage,
  LineCoverage,
} from "../types/coverage.js";
import { BaseCoverageParser, type CoverageFormat } from "./base-parser.js";

/**
 * Parser for Cobertura XML coverage format
 * Used by: coverage.py (Python), JaCoCo (Java), Coverlet (.NET), PHPUnit
 *
 * Format structure:
 * <coverage line-rate="0.85" branch-rate="0.72" ...>
 *   <packages>
 *     <package name="..." line-rate="..." branch-rate="...">
 *       <classes>
 *         <class name="..." filename="..." line-rate="..." branch-rate="...">
 *           <lines>
 *             <line number="1" hits="5" branch="false"/>
 *             <line number="2" hits="0" branch="true" condition-coverage="50% (1/2)"/>
 *           </lines>
 *         </class>
 *       </classes>
 *     </package>
 *   </packages>
 * </coverage>
 */
export class CoberturaParser extends BaseCoverageParser {
  readonly format: CoverageFormat = "cobertura";

  /**
   * Check if content is Cobertura XML format
   * Cobertura has <coverage> root with line-rate attribute and <packages>/<classes> structure
   */
  canParse(content: string, filePath?: string): boolean {
    // Check file extension
    if (filePath) {
      const ext = this.getFileExtension(filePath);
      if (ext !== "xml") {
        return false;
      }
    }

    // Check content structure
    // Cobertura has <coverage> with line-rate/branch-rate attrs and <packages>/<classes>
    const hasCoberturaStructure =
      content.includes("<coverage") &&
      content.includes("line-rate") &&
      content.includes("<packages") &&
      !content.includes("<project") && // Not Clover (which has <project>)
      !content.includes("<report"); // Not JaCoCo (which has <report>)

    return hasCoberturaStructure;
  }

  /**
   * Parse Cobertura XML content
   */
  async parseContent(content: string): Promise<CoverageResults> {
    const result = await parseStringPromise(content, {
      explicitArray: false,
      mergeAttrs: true,
    });

    if (!result.coverage) {
      throw new Error("Invalid Cobertura XML: missing coverage element");
    }

    const coverage = result.coverage;

    // Extract global metrics from coverage element attributes
    const globalLineRate = Number.parseFloat(coverage["line-rate"] || "0");
    const globalBranchRate = Number.parseFloat(coverage["branch-rate"] || "0");

    // Parse all files from packages/classes
    const files: FileCoverage[] = [];
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalConditionals = 0;
    let coveredConditionals = 0;
    let totalMethods = 0;
    let coveredMethods = 0;

    const packages = this.ensureArray(coverage.packages?.package);

    for (const pkg of packages) {
      const classes = this.ensureArray(pkg.classes?.class);

      for (const cls of classes) {
        const fileResult = this.parseClass(cls);
        files.push(fileResult);

        totalStatements += fileResult.statements;
        coveredStatements += fileResult.coveredStatements;
        totalConditionals += fileResult.conditionals;
        coveredConditionals += fileResult.coveredConditionals;
        totalMethods += fileResult.methods;
        coveredMethods += fileResult.coveredMethods;
      }
    }

    const metrics: CoverageMetrics = {
      statements: totalStatements,
      coveredStatements,
      conditionals: totalConditionals,
      coveredConditionals,
      methods: totalMethods,
      coveredMethods,
      elements: totalStatements + totalConditionals,
      coveredElements: coveredStatements + coveredConditionals,
      lineRate:
        totalStatements > 0
          ? this.calculateRate(coveredStatements, totalStatements)
          : globalLineRate * 100,
      branchRate:
        totalConditionals > 0
          ? this.calculateRate(coveredConditionals, totalConditionals)
          : globalBranchRate * 100,
    };

    return {
      timestamp: Number.parseInt(coverage.timestamp || "0", 10),
      metrics,
      files,
    };
  }

  /**
   * Parse a class element into FileCoverage
   */
  private parseClass(classElement: Record<string, unknown>): FileCoverage {
    const filename = (classElement.filename as string) || "";
    const name =
      (classElement.name as string) || filename.split("/").pop() || "";

    const lines: LineCoverage[] = [];
    const missingLines: number[] = [];
    const partialLines: number[] = [];
    const classLines = this.ensureArray(
      (classElement.lines as Record<string, unknown>)?.line
    );

    let statements = 0;
    let coveredStatements = 0;
    let conditionals = 0;
    let coveredConditionals = 0;

    for (const lineData of classLines) {
      const line = lineData as Record<string, unknown>;
      const lineNum = Number.parseInt((line.number as string) || "0", 10);
      const hits = Number.parseInt((line.hits as string) || "0", 10);
      const isBranch = line.branch === "true" || line.branch === true;

      statements++;
      if (hits > 0) {
        coveredStatements++;
      } else {
        missingLines.push(lineNum);
      }

      // Handle branch coverage
      let isPartial = false;
      if (isBranch) {
        const conditionCoverage = line["condition-coverage"] as string;
        if (conditionCoverage) {
          // Parse "50% (1/2)" format
          const match = conditionCoverage.match(/\((\d+)\/(\d+)\)/);
          if (match) {
            const covered = Number.parseInt(match[1], 10);
            const total = Number.parseInt(match[2], 10);
            conditionals += total;
            coveredConditionals += covered;
            // Partial if some but not all branches covered
            if (covered > 0 && covered < total) {
              isPartial = true;
            }
          }
        } else {
          // Assume 2 branches (true/false) if no details
          conditionals += 2;
          if (hits > 0) {
            coveredConditionals += 1; // Conservative estimate
            isPartial = true; // Assume partial
          }
        }
      }

      if (isPartial) {
        partialLines.push(lineNum);
      }

      lines.push({
        lineNumber: lineNum,
        count: hits,
        type: isBranch ? "cond" : "stmt",
      });
    }

    // Parse methods if available
    const methods = this.ensureArray(
      (classElement.methods as Record<string, unknown>)?.method
    );
    let methodCount = methods.length;
    let coveredMethodCount = 0;

    for (const methodData of methods) {
      const method = methodData as Record<string, unknown>;
      const methodLines = this.ensureArray(
        (method.lines as Record<string, unknown>)?.line
      );
      const hasHits = methodLines.some((l) => {
        const lineObj = l as Record<string, unknown>;
        return Number.parseInt((lineObj.hits as string) || "0", 10) > 0;
      });
      if (hasHits) {
        coveredMethodCount++;
      }
    }

    // If no method info, estimate from coverage
    if (methodCount === 0) {
      methodCount = 1;
      coveredMethodCount = coveredStatements > 0 ? 1 : 0;
    }

    return {
      name,
      path: filename,
      statements,
      coveredStatements,
      conditionals,
      coveredConditionals,
      methods: methodCount,
      coveredMethods: coveredMethodCount,
      lineRate: this.calculateRate(coveredStatements, statements),
      branchRate: this.calculateRate(coveredConditionals, conditionals),
      lines,
      missingLines,
      partialLines,
    };
  }
}
