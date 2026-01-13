import type { CoverageResults } from "../types/coverage.js";

/**
 * Supported coverage format types
 */
export type CoverageFormat =
  | "clover"
  | "cobertura"
  | "jacoco"
  | "lcov"
  | "istanbul"
  | "go";

/**
 * Interface for all coverage parsers
 */
export interface ICoverageParser {
  /**
   * The format this parser handles
   */
  readonly format: CoverageFormat;

  /**
   * Parse a coverage file from disk
   * @param filePath Path to the coverage file
   * @returns Parsed coverage results
   */
  parseFile(filePath: string): Promise<CoverageResults>;

  /**
   * Parse coverage data from a string
   * @param content Raw content of the coverage file
   * @returns Parsed coverage results
   */
  parseContent(content: string): Promise<CoverageResults>;

  /**
   * Check if this parser can handle the given content
   * @param content Raw content to check
   * @param filePath Optional file path for extension-based detection
   * @returns true if this parser can handle the content
   */
  canParse(content: string, filePath?: string): boolean;
}

/**
 * Abstract base class providing common functionality for coverage parsers
 */
export abstract class BaseCoverageParser implements ICoverageParser {
  abstract readonly format: CoverageFormat;

  abstract parseContent(content: string): Promise<CoverageResults>;

  abstract canParse(content: string, filePath?: string): boolean;

  async parseFile(filePath: string): Promise<CoverageResults> {
    const fs = await import("node:fs");
    const content = fs.readFileSync(filePath, "utf-8");
    return this.parseContent(content);
  }

  /**
   * Helper to calculate coverage rate as a percentage
   */
  protected calculateRate(covered: number, total: number): number {
    if (total === 0) return 0;
    return Number.parseFloat(((covered / total) * 100).toFixed(2));
  }

  /**
   * Helper to get file extension from path
   */
  protected getFileExtension(filePath: string): string {
    const parts = filePath.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  }
}
