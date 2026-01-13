import * as fs from "node:fs";
import { parseStringPromise } from "xml2js";
import type {
  AggregatedCoverageResults,
  CoverageMetrics,
  CoverageResults,
  FileCoverage,
  LineCoverage,
} from "../types/coverage.js";
import { BaseCoverageParser, type CoverageFormat } from "./base-parser.js";

/**
 * Parser for Clover XML coverage format
 * Used by: Istanbul/NYC (JS/TS), PHPUnit, OpenClover (Java)
 */
export class CloverParser extends BaseCoverageParser {
  readonly format: CoverageFormat = "clover";

  /**
   * Check if content is Clover XML format
   * Clover XML has a <coverage> root with a <project> child element
   */
  canParse(content: string, filePath?: string): boolean {
    // Check file extension first
    if (filePath) {
      const ext = this.getFileExtension(filePath);
      const fileName = filePath.toLowerCase();
      if (fileName.endsWith("clover.xml")) {
        return true;
      }
      if (ext !== "xml") {
        return false;
      }
    }

    // Check content structure - Clover has <coverage> with <project>
    const hasCloverStructure =
      content.includes("<coverage") &&
      content.includes("<project") &&
      content.includes("clover");

    return hasCloverStructure;
  }

  /**
   * Parse Clover XML content
   */
  async parseContent(content: string): Promise<CoverageResults> {
    const result = await parseStringPromise(content, {
      explicitArray: false,
      mergeAttrs: true,
    });

    if (!result.coverage) {
      throw new Error("Invalid Clover XML: missing coverage element");
    }

    const coverage = result.coverage;
    const project = coverage.project;

    if (!project) {
      throw new Error("Invalid Clover XML: missing project element");
    }

    // Parse project metrics
    const metrics = this.parseMetrics(project.metrics);

    // Parse files
    const files: FileCoverage[] = [];
    const projectFiles = Array.isArray(project.file)
      ? project.file
      : project.file
        ? [project.file]
        : [];

    for (const file of projectFiles) {
      files.push(this.parseFileElement(file));
    }

    return {
      timestamp: Number.parseInt(coverage.generated || "0", 10),
      metrics,
      files,
    };
  }

  /**
   * Parse coverage metrics from attributes
   */
  private parseMetrics(metricsAttrs: Record<string, string>): CoverageMetrics {
    const statements = Number.parseInt(metricsAttrs.statements || "0", 10);
    const coveredStatements = Number.parseInt(
      metricsAttrs.coveredstatements || "0",
      10
    );
    const conditionals = Number.parseInt(metricsAttrs.conditionals || "0", 10);
    const coveredConditionals = Number.parseInt(
      metricsAttrs.coveredconditionals || "0",
      10
    );
    const methods = Number.parseInt(metricsAttrs.methods || "0", 10);
    const coveredMethods = Number.parseInt(
      metricsAttrs.coveredmethods || "0",
      10
    );
    const elements = Number.parseInt(metricsAttrs.elements || "0", 10);
    const coveredElements = Number.parseInt(
      metricsAttrs.coveredelements || "0",
      10
    );

    return {
      statements,
      coveredStatements,
      conditionals,
      coveredConditionals,
      methods,
      coveredMethods,
      elements,
      coveredElements,
      lineRate: this.calculateRate(coveredStatements, statements),
      branchRate: this.calculateRate(coveredConditionals, conditionals),
    };
  }

  /**
   * Parse a single file element
   */
  private parseFileElement(fileElement: Record<string, unknown>): FileCoverage {
    const metrics = this.parseMetrics(
      fileElement.metrics as Record<string, string>
    );

    // Parse lines
    const lines: LineCoverage[] = [];
    const fileLines = Array.isArray(fileElement.line)
      ? fileElement.line
      : fileElement.line
        ? [fileElement.line]
        : [];

    for (const line of fileLines) {
      lines.push({
        lineNumber: Number.parseInt((line as Record<string, string>).num, 10),
        count: Number.parseInt((line as Record<string, string>).count, 10),
        type:
          ((line as Record<string, string>).type as "stmt" | "cond" | "method") ||
          "stmt",
        trueCount:
          (line as Record<string, string>).truecount !== undefined
            ? Number.parseInt((line as Record<string, string>).truecount, 10)
            : undefined,
        falseCount:
          (line as Record<string, string>).falsecount !== undefined
            ? Number.parseInt((line as Record<string, string>).falsecount, 10)
            : undefined,
      });
    }

    return {
      name: (fileElement.name as string) || "",
      path: (fileElement.path as string) || "",
      statements: metrics.statements,
      coveredStatements: metrics.coveredStatements,
      conditionals: metrics.conditionals,
      coveredConditionals: metrics.coveredConditionals,
      methods: metrics.methods,
      coveredMethods: metrics.coveredMethods,
      lineRate: metrics.lineRate,
      branchRate: metrics.branchRate,
      lines,
    };
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
 * @deprecated Use CloverParser instead. This alias is kept for backward compatibility.
 */
export const CoverageParser = CloverParser;
