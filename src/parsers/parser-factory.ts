import * as fs from "node:fs/promises";
import type {
  AggregatedCoverageResults,
  CoverageResults,
  FileCoverage,
  LineCoverage,
} from "../types/coverage.js";
import type { CoverageFormat, ICoverageParser } from "./base-parser.js";
import { CloverParser } from "./clover-parser.js";
import { CoberturaParser } from "./cobertura-parser.js";
import { CodecovParser } from "./codecov-parser.js";
import { GoParser } from "./go-parser.js";
import { IstanbulParser } from "./istanbul-parser.js";
import { JaCoCoParser } from "./jacoco-parser.js";
import { LcovParser } from "./lcov-parser.js";

const PARSERS: ICoverageParser[] = [
  new CloverParser(),
  new CoberturaParser(),
  new JaCoCoParser(),
  new LcovParser(),
  new IstanbulParser(),
  new GoParser(),
  new CodecovParser(), // Added last to avoid false positives with other JSON formats
];

/**
 * Factory for creating coverage parsers with auto-detection support
 */
export const CoverageParserFactory = {
  /**
   * Get a parser for a specific format
   * @param format The coverage format to use
   * @returns The parser for the specified format
   */
  getParser(format: CoverageFormat): ICoverageParser {
    const parser = PARSERS.find((p) => p.format === format);
    if (!parser) {
      throw new Error(`Unsupported coverage format: ${format}`);
    }
    return parser;
  },

  /**
   * Auto-detect the coverage format and return the appropriate parser
   * @param content The content to analyze
   * @param filePath Optional file path for extension-based hints
   * @returns The detected parser or null if no match
   */
  detectParser(content: string, filePath?: string): ICoverageParser | null {
    // Try each parser in order of specificity (content-based detection)
    for (const parser of PARSERS) {
      if (parser.canParse(content, filePath)) {
        return parser;
      }
    }

    // Fallback to path-based detection if content detection fails
    if (filePath) {
      const formatFromPath =
        CoverageParserFactory.detectFormatFromPath(filePath);
      if (formatFromPath) {
        return CoverageParserFactory.getParser(formatFromPath);
      }
    }

    return null;
  },

  /**
   * Auto-detect format from file path (extension-based)
   * @param filePath The file path to analyze
   * @returns The detected format or null
   */
  detectFormatFromPath(filePath: string): CoverageFormat | null {
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.endsWith("clover.xml")) {
      return "clover";
    }
    if (
      lowerPath.endsWith("cobertura.xml") ||
      lowerPath.includes("cobertura")
    ) {
      return "cobertura";
    }
    if (lowerPath.endsWith("jacoco.xml") || lowerPath.includes("jacoco")) {
      return "jacoco";
    }
    if (lowerPath.endsWith("lcov.info") || lowerPath.endsWith(".lcov")) {
      return "lcov";
    }
    if (
      lowerPath.endsWith("coverage-final.json") ||
      lowerPath.includes("istanbul")
    ) {
      return "istanbul";
    }
    if (
      lowerPath.endsWith("coverage.out") ||
      lowerPath.endsWith("cover.out") ||
      lowerPath.endsWith(".coverprofile")
    ) {
      return "go";
    }
    if (lowerPath.endsWith("codecov.json")) {
      return "codecov";
    }

    return null;
  },

  /**
   * Parse a coverage file with auto-detection or explicit format
   * @param filePath Path to the coverage file
   * @param format Optional explicit format (uses auto-detection if not provided or 'auto')
   * @returns Parsed coverage results
   */
  async parseFile(
    filePath: string,
    format?: CoverageFormat | "auto"
  ): Promise<CoverageResults> {
    const content = await fs.readFile(filePath, "utf-8");
    return CoverageParserFactory.parseContent(content, filePath, format);
  },

  /**
   * Parse coverage content with auto-detection or explicit format
   * @param content The coverage content to parse
   * @param filePath Optional file path for detection hints
   * @param format Optional explicit format (uses auto-detection if not provided or 'auto')
   * @returns Parsed coverage results
   */
  async parseContent(
    content: string,
    filePath?: string,
    format?: CoverageFormat | "auto"
  ): Promise<CoverageResults> {
    let parser: ICoverageParser | null = null;

    // Use explicit format if provided and not 'auto'
    if (format && format !== "auto") {
      parser = CoverageParserFactory.getParser(format);
    } else {
      // Auto-detect
      parser = CoverageParserFactory.detectParser(content, filePath);
    }

    if (!parser) {
      const hint = filePath ? ` for file: ${filePath}` : "";
      throw new Error(
        `Unable to detect coverage format${hint}. ` +
          "Please specify format explicitly or ensure the file is in a supported format. " +
          `Supported formats: ${CoverageParserFactory.getSupportedFormats().join(
            ", "
          )}`
      );
    }

    return parser.parseContent(content);
  },

  /**
   * Get list of supported format names
   */
  getSupportedFormats(): CoverageFormat[] {
    return PARSERS.map((p) => p.format);
  },

  /**
   * Aggregate multiple coverage results into a single result.
   *
   * Multiple reports covering the same file are merged by path with union
   * semantics: per-line hit counts are combined via max(), so a line hit
   * by any report counts as covered. Without this, overlapping files
   * would be double-counted in the denominator, deflating the rate.
   */
  aggregateResults(results: CoverageResults[]): AggregatedCoverageResults {
    const mergedFiles = mergeFilesByPath(results.flatMap((r) => r.files));

    let totalStatements = 0;
    let coveredStatements = 0;
    let totalConditionals = 0;
    let coveredConditionals = 0;
    let totalMethods = 0;
    let coveredMethods = 0;

    // Detailed metrics for reporting
    let totalHits = 0;
    let totalMisses = 0;
    let totalPartials = 0;
    let totalBranches = 0;
    let totalLines = 0;

    for (const file of mergedFiles) {
      totalStatements += file.statements;
      coveredStatements += file.coveredStatements;
      totalConditionals += file.conditionals;
      coveredConditionals += file.coveredConditionals;
      totalMethods += file.methods;
      coveredMethods += file.coveredMethods;

      for (const line of file.lines) {
        totalLines++;
        if (line.count > 0) {
          totalHits++;
        } else {
          totalMisses++;
        }
      }

      if (file.partialLines) {
        totalPartials += file.partialLines.length;
      }

      totalBranches += file.conditionals;
    }

    const lineRate =
      totalStatements > 0
        ? Number.parseFloat(
            ((coveredStatements / totalStatements) * 100).toFixed(2)
          )
        : 0;
    const branchRate =
      totalConditionals > 0
        ? Number.parseFloat(
            ((coveredConditionals / totalConditionals) * 100).toFixed(2)
          )
        : 0;

    return {
      totalStatements,
      coveredStatements,
      totalConditionals,
      coveredConditionals,
      totalMethods,
      coveredMethods,
      lineRate,
      branchRate,
      files: mergedFiles,
      // Detailed metrics
      totalHits,
      totalMisses,
      totalPartials,
      totalBranches,
      totalFiles: mergedFiles.length,
      totalLines,
    };
  },
};

/**
 * Merge FileCoverage entries that share a path, unioning their line hits.
 * Files with unique paths are returned unchanged.
 */
function mergeFilesByPath(files: FileCoverage[]): FileCoverage[] {
  const byPath = new Map<string, FileCoverage[]>();
  for (const file of files) {
    const key = file.path || file.name;
    const group = byPath.get(key);
    if (group) {
      group.push(file);
    } else {
      byPath.set(key, [file]);
    }
  }

  const result: FileCoverage[] = [];
  for (const group of byPath.values()) {
    result.push(group.length === 1 ? group[0] : mergeFileGroup(group));
  }
  return result;
}

function mergeFileGroup(group: FileCoverage[]): FileCoverage {
  const lineMap = new Map<number, LineCoverage>();
  for (const file of group) {
    for (const line of file.lines) {
      const existing = lineMap.get(line.lineNumber);
      if (!existing) {
        lineMap.set(line.lineNumber, { ...line });
        continue;
      }
      if (line.count > existing.count) {
        existing.count = line.count;
      }
      if (line.type === "cond" || existing.type === "cond") {
        existing.type = "cond";
      } else if (line.type === "method" || existing.type === "method") {
        existing.type = "method";
      }
      if (line.trueCount !== undefined) {
        existing.trueCount = Math.max(existing.trueCount ?? 0, line.trueCount);
      }
      if (line.falseCount !== undefined) {
        existing.falseCount = Math.max(
          existing.falseCount ?? 0,
          line.falseCount
        );
      }
    }
  }

  const mergedLines = [...lineMap.values()].sort(
    (a, b) => a.lineNumber - b.lineNumber
  );

  // Parsers differ on how statements map to lines: cobertura/lcov/jacoco/
  // istanbul emit one "statement" per line entry, but Go counts semantic
  // blocks where one block can span many lines. To stay correct for both,
  // use max() across reports (same file ⇒ same statement count). When
  // statements align 1:1 with lines we can derive coveredStatements from
  // the merged line union exactly; otherwise fall back to max() across
  // reports (a safe underestimate of the true union).
  const statements = Math.max(...group.map((f) => f.statements));
  const lineAligned = group.every((f) => f.statements === f.lines.length);
  const coveredStatements = lineAligned
    ? mergedLines.filter((l) => l.count > 0).length
    : Math.max(...group.map((f) => f.coveredStatements));
  const missingLines = mergedLines
    .filter((l) => l.count === 0)
    .map((l) => l.lineNumber);

  // LineCoverage doesn't carry per-branch hit state, so we can't reliably
  // union branch hits across reports. Same file ⇒ same branch count across
  // reports, so take the max as a best-effort union.
  const conditionals = Math.max(...group.map((f) => f.conditionals));
  const coveredConditionals = Math.max(
    ...group.map((f) => f.coveredConditionals),
  );
  const methods = Math.max(...group.map((f) => f.methods));
  const coveredMethods = Math.max(...group.map((f) => f.coveredMethods));

  // A partial line remains partial only if it still has hits after merge;
  // lines that ended up fully missed are no longer partial.
  const partialSet = new Set<number>();
  for (const file of group) {
    for (const ln of file.partialLines ?? []) partialSet.add(ln);
  }
  const partialLines = [...partialSet]
    .filter((ln) => {
      const l = lineMap.get(ln);
      return l !== undefined && l.count > 0;
    })
    .sort((a, b) => a - b);

  const lineRate =
    statements > 0
      ? Number.parseFloat(((coveredStatements / statements) * 100).toFixed(2))
      : 0;
  const branchRate =
    conditionals > 0
      ? Number.parseFloat(
          ((coveredConditionals / conditionals) * 100).toFixed(2),
        )
      : 0;

  return {
    name: group[0].name,
    path: group[0].path,
    statements,
    coveredStatements,
    conditionals,
    coveredConditionals,
    methods,
    coveredMethods,
    lineRate,
    branchRate,
    lines: mergedLines,
    missingLines,
    partialLines,
  };
}

/**
 * Re-export for convenience
 */
export type { CoverageFormat, ICoverageParser } from "./base-parser.js";
export { CloverParser } from "./clover-parser.js";
export { CoberturaParser } from "./cobertura-parser.js";
export { CodecovParser } from "./codecov-parser.js";
export { GoParser } from "./go-parser.js";
export { IstanbulParser } from "./istanbul-parser.js";
export { JaCoCoParser } from "./jacoco-parser.js";
export { LcovParser } from "./lcov-parser.js";
