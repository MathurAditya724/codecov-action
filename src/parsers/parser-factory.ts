import * as fs from "node:fs";
import type {
  AggregatedCoverageResults,
  CoverageResults,
  FileCoverage,
} from "../types/coverage.js";
import {
  type CoverageFormat,
  type ICoverageParser,
} from "./base-parser.js";
import { CloverParser } from "./clover-parser.js";
import { CoberturaParser } from "./cobertura-parser.js";
import { GoParser } from "./go-parser.js";
import { IstanbulParser } from "./istanbul-parser.js";
import { JaCoCoParser } from "./jacoco-parser.js";
import { LcovParser } from "./lcov-parser.js";

/**
 * Factory for creating coverage parsers with auto-detection support
 */
export class CoverageParserFactory {
  private static parsers: ICoverageParser[] = [
    new CloverParser(),
    new CoberturaParser(),
    new JaCoCoParser(),
    new LcovParser(),
    new IstanbulParser(),
    new GoParser(),
  ];

  /**
   * Get a parser for a specific format
   * @param format The coverage format to use
   * @returns The parser for the specified format
   */
  static getParser(format: CoverageFormat): ICoverageParser {
    const parser = this.parsers.find((p) => p.format === format);
    if (!parser) {
      throw new Error(`Unsupported coverage format: ${format}`);
    }
    return parser;
  }

  /**
   * Auto-detect the coverage format and return the appropriate parser
   * @param content The content to analyze
   * @param filePath Optional file path for extension-based hints
   * @returns The detected parser or null if no match
   */
  static detectParser(
    content: string,
    filePath?: string
  ): ICoverageParser | null {
    // Try each parser in order of specificity
    for (const parser of this.parsers) {
      if (parser.canParse(content, filePath)) {
        return parser;
      }
    }
    return null;
  }

  /**
   * Auto-detect format from file path (extension-based)
   * @param filePath The file path to analyze
   * @returns The detected format or null
   */
  static detectFormatFromPath(filePath: string): CoverageFormat | null {
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
    if (
      lowerPath.endsWith("lcov.info") ||
      lowerPath.endsWith(".lcov") ||
      lowerPath.endsWith(".info")
    ) {
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

    return null;
  }

  /**
   * Parse a coverage file with auto-detection or explicit format
   * @param filePath Path to the coverage file
   * @param format Optional explicit format (uses auto-detection if not provided or 'auto')
   * @returns Parsed coverage results
   */
  static async parseFile(
    filePath: string,
    format?: CoverageFormat | "auto"
  ): Promise<CoverageResults> {
    const content = fs.readFileSync(filePath, "utf-8");
    return this.parseContent(content, filePath, format);
  }

  /**
   * Parse coverage content with auto-detection or explicit format
   * @param content The coverage content to parse
   * @param filePath Optional file path for detection hints
   * @param format Optional explicit format (uses auto-detection if not provided or 'auto')
   * @returns Parsed coverage results
   */
  static async parseContent(
    content: string,
    filePath?: string,
    format?: CoverageFormat | "auto"
  ): Promise<CoverageResults> {
    let parser: ICoverageParser | null = null;

    // Use explicit format if provided and not 'auto'
    if (format && format !== "auto") {
      parser = this.getParser(format);
    } else {
      // Auto-detect
      parser = this.detectParser(content, filePath);
    }

    if (!parser) {
      const hint = filePath ? ` for file: ${filePath}` : "";
      throw new Error(
        `Unable to detect coverage format${hint}. ` +
          "Please specify format explicitly or ensure the file is in a supported format. " +
          `Supported formats: ${this.getSupportedFormats().join(", ")}`
      );
    }

    return parser.parseContent(content);
  }

  /**
   * Get list of supported format names
   */
  static getSupportedFormats(): CoverageFormat[] {
    return this.parsers.map((p) => p.format);
  }

  /**
   * Aggregate multiple coverage results into a single result
   */
  static aggregateResults(
    results: CoverageResults[]
  ): AggregatedCoverageResults {
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalConditionals = 0;
    let coveredConditionals = 0;
    let totalMethods = 0;
    let coveredMethods = 0;

    const allFiles: FileCoverage[] = [];

    for (const result of results) {
      totalStatements += result.metrics.statements;
      coveredStatements += result.metrics.coveredStatements;
      totalConditionals += result.metrics.conditionals;
      coveredConditionals += result.metrics.coveredConditionals;
      totalMethods += result.metrics.methods;
      coveredMethods += result.metrics.coveredMethods;

      allFiles.push(...result.files);
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
      files: allFiles,
    };
  }
}

/**
 * Re-export for convenience
 */
export { type CoverageFormat, type ICoverageParser } from "./base-parser.js";
export { CloverParser } from "./clover-parser.js";
export { CoberturaParser } from "./cobertura-parser.js";
export { GoParser } from "./go-parser.js";
export { IstanbulParser } from "./istanbul-parser.js";
export { JaCoCoParser } from "./jacoco-parser.js";
export { LcovParser } from "./lcov-parser.js";
