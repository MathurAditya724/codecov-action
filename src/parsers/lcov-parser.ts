import type {
  CoverageMetrics,
  CoverageResults,
  FileCoverage,
  LineCoverage,
} from "../types/coverage.js";
import { BaseCoverageParser, type CoverageFormat } from "./base-parser.js";

/**
 * Parser for LCOV coverage format
 * Used by: lcov (C/C++), Istanbul/NYC (JS/TS), c8, Go (via gcov2lcov), Rust (grcov)
 *
 * Format structure (line-based):
 * TN:<test name>
 * SF:<source file path>
 * FN:<line>,<function name>
 * FNDA:<hit count>,<function name>
 * FNF:<functions found>
 * FNH:<functions hit>
 * DA:<line>,<hit count>
 * LF:<lines found>
 * LH:<lines hit>
 * BRDA:<line>,<block>,<branch>,<taken>
 * BRF:<branches found>
 * BRH:<branches hit>
 * end_of_record
 */
export class LcovParser extends BaseCoverageParser {
  readonly format: CoverageFormat = "lcov";

  /**
   * Check if content is LCOV format
   */
  canParse(content: string, filePath?: string): boolean {
    // Check file extension
    if (filePath) {
      const ext = this.getFileExtension(filePath);
      const fileName = filePath.toLowerCase();
      if (
        ext === "info" ||
        fileName.endsWith("lcov.info") ||
        fileName.endsWith(".lcov")
      ) {
        return true;
      }
    }

    // Check content structure - LCOV has specific markers
    const hasLcovMarkers =
      content.includes("SF:") &&
      (content.includes("DA:") || content.includes("LF:")) &&
      content.includes("end_of_record");

    return hasLcovMarkers;
  }

  /**
   * Parse LCOV content
   */
  async parseContent(content: string): Promise<CoverageResults> {
    const files: FileCoverage[] = [];
    const records = content.split("end_of_record");

    for (const record of records) {
      const trimmedRecord = record.trim();
      if (!trimmedRecord) continue;

      const fileResult = this.parseRecord(trimmedRecord);
      if (fileResult) {
        files.push(fileResult);
      }
    }

    // Calculate aggregate metrics
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalConditionals = 0;
    let coveredConditionals = 0;
    let totalMethods = 0;
    let coveredMethods = 0;

    for (const file of files) {
      totalStatements += file.statements;
      coveredStatements += file.coveredStatements;
      totalConditionals += file.conditionals;
      coveredConditionals += file.coveredConditionals;
      totalMethods += file.methods;
      coveredMethods += file.coveredMethods;
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
      lineRate: this.calculateRate(coveredStatements, totalStatements),
      branchRate: this.calculateRate(coveredConditionals, totalConditionals),
    };

    return {
      timestamp: Date.now(),
      metrics,
      files,
    };
  }

  /**
   * Parse a single LCOV record (one file)
   */
  private parseRecord(record: string): FileCoverage | null {
    const lines = record.split("\n");
    let sourceFile = "";
    const lineData: Map<number, number> = new Map();
    const branchData: Map<number, { total: number; covered: number }> =
      new Map();
    let functionsFound = 0;
    let functionsHit = 0;
    let linesFound = 0;
    let linesHit = 0;
    let branchesFound = 0;
    let branchesHit = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Source file
      if (trimmed.startsWith("SF:")) {
        sourceFile = trimmed.substring(3);
        continue;
      }

      // Line data: DA:<line>,<hit count>[,<checksum>]
      if (trimmed.startsWith("DA:")) {
        const parts = trimmed.substring(3).split(",");
        if (parts.length >= 2) {
          const lineNum = Number.parseInt(parts[0], 10);
          const hitCount = Number.parseInt(parts[1], 10);
          lineData.set(lineNum, hitCount);
        }
        continue;
      }

      // Lines found/hit
      if (trimmed.startsWith("LF:")) {
        linesFound = Number.parseInt(trimmed.substring(3), 10);
        continue;
      }
      if (trimmed.startsWith("LH:")) {
        linesHit = Number.parseInt(trimmed.substring(3), 10);
        continue;
      }

      // Functions found/hit
      if (trimmed.startsWith("FNF:")) {
        functionsFound = Number.parseInt(trimmed.substring(4), 10);
        continue;
      }
      if (trimmed.startsWith("FNH:")) {
        functionsHit = Number.parseInt(trimmed.substring(4), 10);
        continue;
      }

      // Branches found/hit
      if (trimmed.startsWith("BRF:")) {
        branchesFound = Number.parseInt(trimmed.substring(4), 10);
        continue;
      }
      if (trimmed.startsWith("BRH:")) {
        branchesHit = Number.parseInt(trimmed.substring(4), 10);
        continue;
      }

      // Branch data: BRDA:<line>,<block>,<branch>,<taken>
      if (trimmed.startsWith("BRDA:")) {
        const parts = trimmed.substring(5).split(",");
        if (parts.length >= 4) {
          const lineNum = Number.parseInt(parts[0], 10);
          const taken = parts[3] === "-" ? 0 : Number.parseInt(parts[3], 10);

          if (!branchData.has(lineNum)) {
            branchData.set(lineNum, { total: 0, covered: 0 });
          }
          const existing = branchData.get(lineNum)!;
          existing.total++;
          if (taken > 0) {
            existing.covered++;
          }
        }
        continue;
      }
    }

    if (!sourceFile) {
      return null;
    }

    // Calculate from line data if LF/LH not provided
    if (linesFound === 0 && lineData.size > 0) {
      linesFound = lineData.size;
      linesHit = Array.from(lineData.values()).filter((h) => h > 0).length;
    }

    // Calculate branch coverage from BRDA if BRF/BRH not provided
    if (branchesFound === 0 && branchData.size > 0) {
      for (const branch of branchData.values()) {
        branchesFound += branch.total;
        branchesHit += branch.covered;
      }
    }

    // Build line coverage array
    const lineCoverage: LineCoverage[] = [];
    for (const [lineNum, hitCount] of lineData.entries()) {
      const hasBranch = branchData.has(lineNum);
      lineCoverage.push({
        lineNumber: lineNum,
        count: hitCount,
        type: hasBranch ? "cond" : "stmt",
      });
    }

    // Sort by line number
    lineCoverage.sort((a, b) => a.lineNumber - b.lineNumber);

    const fileName = sourceFile.split("/").pop() || sourceFile;

    return {
      name: fileName,
      path: sourceFile,
      statements: linesFound,
      coveredStatements: linesHit,
      conditionals: branchesFound,
      coveredConditionals: branchesHit,
      methods: functionsFound,
      coveredMethods: functionsHit,
      lineRate: this.calculateRate(linesHit, linesFound),
      branchRate: this.calculateRate(branchesHit, branchesFound),
      lines: lineCoverage,
    };
  }
}
