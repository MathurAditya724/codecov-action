import { parseStringPromise } from "xml2js";
import type {
  CoverageMetrics,
  CoverageResults,
  FileCoverage,
  LineCoverage,
} from "../types/coverage.js";
import { BaseCoverageParser, type CoverageFormat } from "./base-parser.js";

/**
 * Parser for JaCoCo XML coverage format
 * Used by: JaCoCo (Java), Kotlin, Scala
 *
 * Format structure:
 * <report name="project">
 *   <package name="com/example">
 *     <class name="com/example/MyClass" sourcefilename="MyClass.java">
 *       <method name="myMethod" desc="()V" line="10">
 *         <counter type="INSTRUCTION" missed="0" covered="15"/>
 *         <counter type="LINE" missed="0" covered="5"/>
 *         <counter type="BRANCH" missed="1" covered="3"/>
 *       </method>
 *       <counter type="LINE" missed="2" covered="20"/>
 *     </class>
 *     <sourcefile name="MyClass.java">
 *       <line nr="1" mi="0" ci="3" mb="0" cb="0"/>
 *       <counter type="LINE" missed="2" covered="20"/>
 *     </sourcefile>
 *   </package>
 *   <counter type="LINE" missed="100" covered="1000"/>
 * </report>
 */
export class JaCoCoParser extends BaseCoverageParser {
  readonly format: CoverageFormat = "jacoco";

  /**
   * Check if content is JaCoCo XML format
   * JaCoCo has <report> root with <package>/<class>/<counter> structure
   */
  canParse(content: string, filePath?: string): boolean {
    // Check file extension
    if (filePath) {
      const fileName = filePath.toLowerCase();
      if (fileName.endsWith("jacoco.xml")) {
        return true;
      }
      const ext = this.getFileExtension(filePath);
      if (ext !== "xml") {
        return false;
      }
    }

    // Check content structure
    // JaCoCo has <report> root and uses <counter type="..."> elements
    const hasJaCoCoStructure =
      content.includes("<report") &&
      content.includes('<counter type="') &&
      !content.includes("<coverage"); // Not Cobertura/Clover

    return hasJaCoCoStructure;
  }

  /**
   * Parse JaCoCo XML content
   */
  async parseContent(content: string): Promise<CoverageResults> {
    const result = await parseStringPromise(content, {
      explicitArray: false,
      mergeAttrs: true,
    });

    if (!result.report) {
      throw new Error("Invalid JaCoCo XML: missing report element");
    }

    const report = result.report;

    // Parse all source files from packages
    const files: FileCoverage[] = [];
    const packages = this.ensureArray(report.package);

    for (const pkg of packages) {
      const packageName = pkg.name || "";
      const sourceFiles = this.ensureArray(pkg.sourcefile);

      for (const sourceFile of sourceFiles) {
        const fileResult = this.parseSourceFile(sourceFile, packageName);
        files.push(fileResult);
      }
    }

    // Get report-level counters
    const reportCounters = this.parseCounters(this.ensureArray(report.counter));

    const metrics: CoverageMetrics = {
      statements: reportCounters.line.total,
      coveredStatements: reportCounters.line.covered,
      conditionals: reportCounters.branch.total,
      coveredConditionals: reportCounters.branch.covered,
      methods: reportCounters.method.total,
      coveredMethods: reportCounters.method.covered,
      elements: reportCounters.line.total + reportCounters.branch.total,
      coveredElements:
        reportCounters.line.covered + reportCounters.branch.covered,
      lineRate: this.calculateRate(
        reportCounters.line.covered,
        reportCounters.line.total
      ),
      branchRate: this.calculateRate(
        reportCounters.branch.covered,
        reportCounters.branch.total
      ),
    };

    return {
      timestamp: Date.now(),
      metrics,
      files,
    };
  }

  /**
   * Parse a sourcefile element into FileCoverage
   */
  private parseSourceFile(
    sourceFile: Record<string, unknown>,
    packageName: string
  ): FileCoverage {
    const fileName = (sourceFile.name as string) || "";
    const packagePath = packageName.replace(/\./g, "/");
    const fullPath = packagePath ? `${packagePath}/${fileName}` : fileName;

    // Parse line-by-line coverage
    const lines: LineCoverage[] = [];
    const sourceLines = this.ensureArray(sourceFile.line);

    for (const line of sourceLines) {
      const lineNum = Number.parseInt(line.nr || "0", 10);
      const coveredInstructions = Number.parseInt(line.ci || "0", 10);
      const missedBranches = Number.parseInt(line.mb || "0", 10);
      const coveredBranches = Number.parseInt(line.cb || "0", 10);

      const hasBranches = missedBranches > 0 || coveredBranches > 0;
      const isCovered = coveredInstructions > 0;

      lines.push({
        lineNumber: lineNum,
        count: isCovered ? coveredInstructions : 0,
        type: hasBranches ? "cond" : "stmt",
        trueCount: hasBranches ? coveredBranches : undefined,
        falseCount: hasBranches ? missedBranches : undefined,
      });
    }

    // Sort by line number
    lines.sort((a, b) => a.lineNumber - b.lineNumber);

    // Parse counters for this source file
    const counters = this.parseCounters(this.ensureArray(sourceFile.counter));

    return {
      name: fileName,
      path: fullPath,
      statements: counters.line.total,
      coveredStatements: counters.line.covered,
      conditionals: counters.branch.total,
      coveredConditionals: counters.branch.covered,
      methods: counters.method.total,
      coveredMethods: counters.method.covered,
      lineRate: this.calculateRate(counters.line.covered, counters.line.total),
      branchRate: this.calculateRate(
        counters.branch.covered,
        counters.branch.total
      ),
      lines,
    };
  }

  /**
   * Parse counter elements into a structured object
   */
  private parseCounters(counters: Array<Record<string, unknown>>): {
    instruction: { missed: number; covered: number; total: number };
    line: { missed: number; covered: number; total: number };
    branch: { missed: number; covered: number; total: number };
    method: { missed: number; covered: number; total: number };
    class: { missed: number; covered: number; total: number };
    complexity: { missed: number; covered: number; total: number };
  } {
    const result = {
      instruction: { missed: 0, covered: 0, total: 0 },
      line: { missed: 0, covered: 0, total: 0 },
      branch: { missed: 0, covered: 0, total: 0 },
      method: { missed: 0, covered: 0, total: 0 },
      class: { missed: 0, covered: 0, total: 0 },
      complexity: { missed: 0, covered: 0, total: 0 },
    };

    for (const counter of counters) {
      const type = ((counter.type as string) || "").toLowerCase();
      const missed = Number.parseInt((counter.missed as string) || "0", 10);
      const covered = Number.parseInt((counter.covered as string) || "0", 10);

      if (type in result) {
        const key = type as keyof typeof result;
        result[key] = {
          missed,
          covered,
          total: missed + covered,
        };
      }
    }

    return result;
  }

  /**
   * Ensure value is an array
   */
  private ensureArray<T>(value: T | T[] | undefined): T[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
}
