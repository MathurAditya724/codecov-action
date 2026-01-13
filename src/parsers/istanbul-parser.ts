import type {
  CoverageMetrics,
  CoverageResults,
  FileCoverage,
  LineCoverage,
} from "../types/coverage.js";
import { BaseCoverageParser, type CoverageFormat } from "./base-parser.js";

/**
 * Istanbul coverage JSON format types
 */
interface IstanbulLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

interface IstanbulStatementMap {
  [key: string]: IstanbulLocation;
}

interface IstanbulFunctionMap {
  [key: string]: {
    name: string;
    decl: IstanbulLocation;
    loc: IstanbulLocation;
    line: number;
  };
}

interface IstanbulBranchMap {
  [key: string]: {
    loc: IstanbulLocation;
    type: string;
    locations: IstanbulLocation[];
    line: number;
  };
}

interface IstanbulFileCoverage {
  path: string;
  statementMap: IstanbulStatementMap;
  fnMap: IstanbulFunctionMap;
  branchMap: IstanbulBranchMap;
  s: { [key: string]: number };
  f: { [key: string]: number };
  b: { [key: string]: number[] };
}

type IstanbulCoverageData = {
  [filePath: string]: IstanbulFileCoverage;
};

/**
 * Parser for Istanbul/NYC JSON coverage format (coverage-final.json)
 * Used by: Jest, Vitest, NYC, c8 (with JSON reporter)
 *
 * Format structure:
 * {
 *   "/path/to/file.ts": {
 *     "path": "/path/to/file.ts",
 *     "statementMap": { "0": { "start": {...}, "end": {...} }, ... },
 *     "fnMap": { "0": { "name": "fn", "decl": {...}, "loc": {...}, "line": 5 }, ... },
 *     "branchMap": { "0": { "loc": {...}, "type": "if", "locations": [...], "line": 7 }, ... },
 *     "s": { "0": 5, "1": 3, ... },  // statement hit counts
 *     "f": { "0": 5, ... },           // function hit counts
 *     "b": { "0": [3, 2], ... }       // branch hit counts
 *   }
 * }
 */
export class IstanbulParser extends BaseCoverageParser {
  readonly format: CoverageFormat = "istanbul";

  /**
   * Check if content is Istanbul JSON format
   */
  canParse(content: string, filePath?: string): boolean {
    // Check file extension
    if (filePath) {
      const fileName = filePath.toLowerCase();
      if (
        fileName.endsWith("coverage-final.json") ||
        fileName.endsWith("coverage-summary.json")
      ) {
        return true;
      }
      const ext = this.getFileExtension(filePath);
      if (ext !== "json") {
        return false;
      }
    }

    // Check content structure
    try {
      // Quick check for Istanbul markers without full parse
      const hasIstanbulMarkers =
        content.includes('"statementMap"') &&
        content.includes('"fnMap"') &&
        content.includes('"branchMap"') &&
        (content.includes('"s"') || content.includes('"f"'));

      return hasIstanbulMarkers;
    } catch {
      return false;
    }
  }

  /**
   * Parse Istanbul JSON content
   */
  async parseContent(content: string): Promise<CoverageResults> {
    let data: IstanbulCoverageData;

    try {
      data = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Invalid Istanbul JSON: ${error instanceof Error ? error.message : "parse error"}`
      );
    }

    const files: FileCoverage[] = [];
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalConditionals = 0;
    let coveredConditionals = 0;
    let totalMethods = 0;
    let coveredMethods = 0;

    for (const [, fileCoverage] of Object.entries(data)) {
      const fileResult = this.parseFileCoverage(fileCoverage);
      files.push(fileResult);

      totalStatements += fileResult.statements;
      coveredStatements += fileResult.coveredStatements;
      totalConditionals += fileResult.conditionals;
      coveredConditionals += fileResult.coveredConditionals;
      totalMethods += fileResult.methods;
      coveredMethods += fileResult.coveredMethods;
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
   * Parse a single file's coverage data
   */
  private parseFileCoverage(fileCoverage: IstanbulFileCoverage): FileCoverage {
    const filePath = fileCoverage.path;
    const fileName = filePath.split("/").pop() || filePath;

    // Parse statements
    const statementMap = fileCoverage.statementMap || {};
    const statementHits = fileCoverage.s || {};
    const totalStatements = Object.keys(statementMap).length;
    const coveredStatements = Object.values(statementHits).filter(
      (h) => h > 0
    ).length;

    // Parse functions
    const fnMap = fileCoverage.fnMap || {};
    const fnHits = fileCoverage.f || {};
    const totalMethods = Object.keys(fnMap).length;
    const coveredMethods = Object.values(fnHits).filter((h) => h > 0).length;

    // Parse branches
    const branchMap = fileCoverage.branchMap || {};
    const branchHits = fileCoverage.b || {};
    let totalBranches = 0;
    let coveredBranches = 0;

    for (const [branchId, branch] of Object.entries(branchMap)) {
      const branchCount = branch.locations?.length || 0;
      totalBranches += branchCount;

      const hits = branchHits[branchId] || [];
      coveredBranches += hits.filter((h) => h > 0).length;
    }

    // Build line coverage from statements
    const lineMap: Map<number, { count: number; hasBranch: boolean }> =
      new Map();

    // Add statement lines
    for (const [stmtId, stmt] of Object.entries(statementMap)) {
      const line = stmt.start.line;
      const hitCount = statementHits[stmtId] || 0;

      if (!lineMap.has(line)) {
        lineMap.set(line, { count: hitCount, hasBranch: false });
      } else {
        const existing = lineMap.get(line)!;
        existing.count = Math.max(existing.count, hitCount);
      }
    }

    // Mark lines with branches
    for (const branch of Object.values(branchMap)) {
      const line = branch.line;
      if (lineMap.has(line)) {
        lineMap.get(line)!.hasBranch = true;
      }
    }

    // Convert to LineCoverage array
    const lines: LineCoverage[] = [];
    for (const [lineNum, data] of lineMap.entries()) {
      lines.push({
        lineNumber: lineNum,
        count: data.count,
        type: data.hasBranch ? "cond" : "stmt",
      });
    }

    // Sort by line number
    lines.sort((a, b) => a.lineNumber - b.lineNumber);

    return {
      name: fileName,
      path: filePath,
      statements: totalStatements,
      coveredStatements,
      conditionals: totalBranches,
      coveredConditionals: coveredBranches,
      methods: totalMethods,
      coveredMethods,
      lineRate: this.calculateRate(coveredStatements, totalStatements),
      branchRate: this.calculateRate(coveredBranches, totalBranches),
      lines,
    };
  }
}
