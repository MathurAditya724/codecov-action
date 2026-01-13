import * as fs from "node:fs";
import * as path from "node:path";
import * as core from "@actions/core";
import * as glob from "@actions/glob";
import { PRCommentFormatter } from "./formatters/pr-comment-formatter.js";
import { JUnitParser } from "./parsers/junit-parser.js";
import {
  type CoverageFormat,
  CoverageParserFactory,
} from "./parsers/parser-factory.js";
import type { CoverageResults } from "./types/coverage.js";
import type { TestResults } from "./types/test-results.js";
import { ArtifactManager } from "./utils/artifact-manager.js";
import { TestResultsComparator } from "./utils/comparison.js";
import { CoverageComparator } from "./utils/coverage-comparison.js";
import { FileFinder } from "./utils/file-finder.js";
import { GitHubClient } from "./utils/github-client.js";
import { writeJobSummary } from "./utils/summary-writer.js";

/**
 * Coverage input configuration
 */
interface CoverageConfig {
  files: string[];
  directory: string;
  exclude: string[];
  format: CoverageFormat | "auto";
  disableSearch: boolean;
  failCiIfError: boolean;
  handleNoReportsFound: boolean;
  verbose: boolean;
  flags: string[];
  name: string;
}

/**
 * Parse coverage configuration from action inputs
 */
function getCoverageConfig(): CoverageConfig {
  // Get files input (comma-separated)
  const filesInput = core.getInput("files");
  const files = filesInput
    ? filesInput
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
    : [];

  // Get directory
  const directory = core.getInput("directory") || ".";

  // Get exclude patterns (comma-separated)
  const excludeInput = core.getInput("exclude");
  const exclude = excludeInput
    ? excludeInput
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
    : [];

  // Get format
  const formatInput = core.getInput("coverage-format") || "auto";
  const format = formatInput as CoverageFormat | "auto";

  // Get boolean flags
  const disableSearch = core.getBooleanInput("disable-search") === true;
  const failCiIfError = core.getBooleanInput("fail-ci-if-error") === true;
  const handleNoReportsFound =
    core.getBooleanInput("handle-no-reports-found") === true;
  const verbose = core.getBooleanInput("verbose") === true;

  // Get flags (comma-separated)
  const flagsInput = core.getInput("flags");
  const flags = flagsInput
    ? flagsInput
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
    : [];

  // Get name
  const name = core.getInput("name") || "";

  return {
    files,
    directory,
    exclude,
    format,
    disableSearch,
    failCiIfError,
    handleNoReportsFound,
    verbose,
    flags,
    name,
  };
}

/**
 * Log message if verbose mode is enabled
 */
function verboseLog(message: string, verbose: boolean): void {
  if (verbose) {
    core.info(`[verbose] ${message}`);
  }
}

async function run() {
  try {
    // Get inputs
    const junitPattern =
      core.getInput("junit-xml-pattern") || "./**/*.junit.xml";
    const token = core.getInput("token");
    const baseBranch = core.getInput("base-branch") || "main";
    const enableTests = core.getBooleanInput("enable-tests") !== false;
    const enableCoverage = core.getBooleanInput("enable-coverage") !== false;
    const postPrComment = core.getBooleanInput("post-pr-comment") === true;

    // Get coverage config
    const coverageConfig = getCoverageConfig();

    if (!token) {
      throw new Error(
        "GitHub token is required. Please provide 'token' input."
      );
    }

    if (coverageConfig.verbose) {
      core.info("🔍 Verbose mode enabled");
      core.info(`Coverage config: ${JSON.stringify(coverageConfig, null, 2)}`);
    }

    core.info(`Base branch for comparison: ${baseBranch}`);

    // Initialize GitHub client
    const githubClient = new GitHubClient(token);
    const contextInfo = githubClient.getContextInfo();
    core.info(
      `Context: ${contextInfo.eventName} in ${contextInfo.owner}/${contextInfo.repo}`
    );

    // Log context info
    core.info(`Post PR comment: ${postPrComment}`);

    // Initialize artifact manager
    const artifactManager = new ArtifactManager(token);
    const currentBranch = ArtifactManager.getCurrentBranch();
    core.info(`Current branch: ${currentBranch}`);

    // Process test results if enabled
    let aggregatedTestResults = null;
    if (enableTests) {
      aggregatedTestResults = await processTestResults(
        junitPattern,
        artifactManager,
        currentBranch,
        baseBranch
      );
    }

    // Process coverage if enabled
    let aggregatedCoverageResults = null;
    if (enableCoverage) {
      aggregatedCoverageResults = await processCoverage(
        coverageConfig,
        artifactManager,
        currentBranch,
        baseBranch
      );
    }

    // Write Job Summary (always)
    core.info("📝 Writing Job Summary...");
    await writeJobSummary(
      aggregatedTestResults || undefined,
      aggregatedCoverageResults || undefined
    );

    // Optionally post PR comment if enabled and in PR context
    if (postPrComment && githubClient.isPullRequest()) {
      const formatter = new PRCommentFormatter();
      const commentBody = formatter.formatComment(
        aggregatedTestResults || undefined,
        aggregatedCoverageResults || undefined
      );

      core.info("📝 Posting results to PR comment...");
      await githubClient.postOrUpdateComment(commentBody);
    }

    core.info("✅ Codecov Action completed successfully!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    core.setFailed(`Action failed: ${message}`);
  }
}

/**
 * Process test results
 */
async function processTestResults(
  junitPattern: string,
  artifactManager: ArtifactManager,
  currentBranch: string,
  baseBranch: string
) {
  core.info("📊 Processing test results...");

  // Find JUnit XML files
  const fileFinder = new FileFinder();
  const files = await fileFinder.findFiles(junitPattern);

  if (files.length === 0) {
    core.warning(`No JUnit XML files found matching pattern: ${junitPattern}`);
    core.warning(
      "Please ensure your test framework is generating JUnit XML output."
    );
    core.setOutput("total-tests", "0");
    core.setOutput("passed-tests", "0");
    core.setOutput("failed-tests", "0");
    core.setOutput("test-pass-rate", "0");
    core.setOutput("tests-added", "0");
    core.setOutput("tests-removed", "0");
    core.setOutput("tests-fixed", "0");
    core.setOutput("tests-broken", "0");
    return null;
  }

  // Validate files
  const validFiles = fileFinder.validateFiles(files);
  if (validFiles.length === 0) {
    throw new Error("No valid JUnit XML files found");
  }

  core.info(`Processing ${validFiles.length} JUnit XML file(s)`);

  // Parse all JUnit XML files
  const parser = new JUnitParser();
  const allResults: TestResults[] = [];

  for (const file of validFiles) {
    try {
      core.info(`Parsing: ${file}`);
      const result = parser.parseFile(file);
      allResults.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.error(`Failed to parse ${file}: ${message}`);
      // Continue with other files
    }
  }

  if (allResults.length === 0) {
    throw new Error("Failed to parse any JUnit XML files");
  }

  // Aggregate results
  const aggregatedResults = JUnitParser.aggregateResults(allResults);

  core.info("📊 Test Results Summary:");
  core.info(`  Total Tests: ${aggregatedResults.totalTests}`);
  core.info(`  Passed: ${aggregatedResults.passedTests}`);
  core.info(`  Failed: ${aggregatedResults.failedTests}`);
  core.info(`  Skipped: ${aggregatedResults.skippedTests}`);
  core.info(`  Pass Rate: ${aggregatedResults.passRate}%`);

  // Upload current results as artifact
  await artifactManager.uploadResults(aggregatedResults, currentBranch);

  // Download and compare with base branch results
  const baseResults = await artifactManager.downloadBaseResults(baseBranch);
  if (baseResults) {
    core.info("🔍 Comparing with base branch test results...");
    const comparison = TestResultsComparator.compareResults(
      baseResults,
      aggregatedResults
    );
    aggregatedResults.comparison = comparison;

    // Log comparison summary
    core.info("📈 Test Comparison Summary:");
    core.info(
      `  Total Tests: ${comparison.deltaTotal >= 0 ? "+" : ""}${
        comparison.deltaTotal
      }`
    );
    core.info(
      `  Passed Tests: ${comparison.deltaPassed >= 0 ? "+" : ""}${
        comparison.deltaPassed
      }`
    );
    core.info(
      `  Failed Tests: ${comparison.deltaFailed >= 0 ? "+" : ""}${
        comparison.deltaFailed
      }`
    );
    core.info(`  Tests Added: ${comparison.testsAdded.length}`);
    core.info(`  Tests Removed: ${comparison.testsRemoved.length}`);
    core.info(`  Tests Fixed: ${comparison.testsFixed.length}`);
    core.info(`  Tests Broken: ${comparison.testsBroken.length}`);

    // Set comparison outputs
    core.setOutput("tests-added", comparison.testsAdded.length.toString());
    core.setOutput("tests-removed", comparison.testsRemoved.length.toString());
    core.setOutput("tests-fixed", comparison.testsFixed.length.toString());
    core.setOutput("tests-broken", comparison.testsBroken.length.toString());
  } else {
    core.info("ℹ️ No base test results available for comparison");
    // Set comparison outputs to 0
    core.setOutput("tests-added", "0");
    core.setOutput("tests-removed", "0");
    core.setOutput("tests-fixed", "0");
    core.setOutput("tests-broken", "0");
  }

  // Set outputs
  core.setOutput("total-tests", aggregatedResults.totalTests.toString());
  core.setOutput("passed-tests", aggregatedResults.passedTests.toString());
  core.setOutput("failed-tests", aggregatedResults.failedTests.toString());
  core.setOutput("test-pass-rate", aggregatedResults.passRate.toString());

  return aggregatedResults;
}

/**
 * Find coverage files based on configuration
 */
async function findCoverageFiles(config: CoverageConfig): Promise<string[]> {
  const { files, directory, exclude, disableSearch, verbose } = config;

  // If explicit files are provided
  if (files.length > 0) {
    verboseLog(`Using explicit files: ${files.join(", ")}`, verbose);
    return files;
  }

  // If search is disabled but no files provided
  if (disableSearch) {
    return [];
  }

  // Auto-discover coverage files
  verboseLog(
    `Searching for coverage files in directory: ${directory}`,
    verbose
  );

  // Default patterns for common coverage files
  const defaultPatterns = [
    "**/clover.xml",
    "**/cobertura.xml",
    "**/coverage.xml",
    "**/jacoco.xml",
    "**/lcov.info",
    "**/*.lcov",
    "**/coverage-final.json",
    "**/coverage.out",
    "**/cover.out",
  ];

  // Check for legacy coverage-xml-pattern input
  const legacyPattern = core.getInput("coverage-xml-pattern");
  if (legacyPattern) {
    core.warning(
      "The 'coverage-xml-pattern' input is deprecated. Please use 'files' or 'directory' instead."
    );
    verboseLog(`Using legacy coverage-xml-pattern: ${legacyPattern}`, verbose);
    const globber = await glob.create(legacyPattern, {
      followSymbolicLinks: false,
    });
    return globber.glob();
  }

  // Build glob patterns
  const patterns = defaultPatterns.map((p) => path.join(directory, p));

  // Add exclude patterns
  const excludePatterns = exclude.map((e) => `!${path.join(directory, e)}`);
  const allPatterns = [...patterns, ...excludePatterns];

  verboseLog(`Search patterns: ${allPatterns.join(", ")}`, verbose);

  const globber = await glob.create(allPatterns.join("\n"), {
    followSymbolicLinks: false,
  });

  const foundFiles = await globber.glob();
  verboseLog(`Found ${foundFiles.length} coverage file(s)`, verbose);

  return foundFiles;
}

/**
 * Process coverage results with multi-format support
 */
async function processCoverage(
  config: CoverageConfig,
  artifactManager: ArtifactManager,
  currentBranch: string,
  baseBranch: string
) {
  const { format, failCiIfError, handleNoReportsFound, verbose, flags, name } =
    config;

  core.info("🎯 Processing coverage results...");
  if (name) {
    core.info(`Coverage upload name: ${name}`);
    core.setOutput("coverage-name", name);
  }
  if (flags.length > 0) {
    const flagsValue = flags.join(",");
    core.info(`Coverage flags: ${flags.join(", ")}`);
    core.setOutput("coverage-flags", flagsValue);
  }

  // Find coverage files
  const files = await findCoverageFiles(config);

  if (files.length === 0) {
    const message = "No coverage files found";
    if (failCiIfError && !handleNoReportsFound) {
      throw new Error(message);
    }
    core.warning(message);
    if (!handleNoReportsFound) {
      core.warning(
        `Supported formats: ${CoverageParserFactory.getSupportedFormats().join(
          ", "
        )}`
      );
    }
    // Set default outputs for no reports case
    core.setOutput("line-coverage", "0");
    core.setOutput("branch-coverage", "0");
    core.setOutput("coverage-change", "0");
    core.setOutput("coverage-format", "none");
    return null;
  }

  // Validate files exist
  const fileFinder = new FileFinder();
  const validFiles = fileFinder.validateFiles(files);
  if (validFiles.length === 0) {
    const message = "No valid coverage files found";
    if (failCiIfError) {
      throw new Error(message);
    }
    core.warning(message);
    return null;
  }

  core.info(`Processing ${validFiles.length} coverage file(s)`);
  core.info(`Format: ${format === "auto" ? "auto-detect" : format}`);

  // Parse all coverage files
  const allResults: CoverageResults[] = [];
  let detectedFormat: CoverageFormat | null = null;

  for (const file of validFiles) {
    try {
      verboseLog(`Parsing coverage: ${file}`, verbose);

      // Read file once and use for both parsing and format detection
      const content = fs.readFileSync(file, "utf-8");

      // Determine the format to use and log
      let fileFormat: CoverageFormat | "auto" = format;
      if (format === "auto") {
        const parser = CoverageParserFactory.detectParser(content, file);
        if (parser) {
          fileFormat = parser.format;
          if (detectedFormat === null) {
            detectedFormat = parser.format;
          }
        }
      } else {
        // When explicit format is provided, use it for tracking
        if (detectedFormat === null) {
          detectedFormat = format;
        }
      }

      const result = await CoverageParserFactory.parseContent(
        content,
        file,
        format
      );
      allResults.push(result);

      core.info(`✓ Parsed ${file} (${fileFormat})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (failCiIfError) {
        throw new Error(`Failed to parse ${file}: ${message}`);
      }
      core.error(`Failed to parse ${file}: ${message}`);
      // Continue with other files
    }
  }

  if (allResults.length === 0) {
    const message = "Failed to parse any coverage files";
    if (failCiIfError) {
      throw new Error(message);
    }
    core.warning(message);
    return null;
  }

  // Aggregate results
  const aggregatedResults = CoverageParserFactory.aggregateResults(allResults);

  // Add flags and name metadata to the results
  if (flags.length > 0) {
    aggregatedResults.flags = flags;
  }
  if (name) {
    aggregatedResults.name = name;
  }

  core.info("🎯 Coverage Summary:");
  core.info(`  Format: ${detectedFormat ?? "unknown"}`);
  if (flags.length > 0) {
    core.info(`  Flags: ${flags.join(", ")}`);
  }
  if (name) {
    core.info(`  Name: ${name}`);
  }
  core.info(`  Line Coverage: ${aggregatedResults.lineRate}%`);
  core.info(`  Branch Coverage: ${aggregatedResults.branchRate}%`);
  core.info(
    `  Statements: ${aggregatedResults.coveredStatements}/${aggregatedResults.totalStatements}`
  );
  core.info(
    `  Conditionals: ${aggregatedResults.coveredConditionals}/${aggregatedResults.totalConditionals}`
  );
  core.info(
    `  Methods: ${aggregatedResults.coveredMethods}/${aggregatedResults.totalMethods}`
  );

  // Upload current coverage as artifact (with flags for separate storage)
  await artifactManager.uploadCoverageResults(
    aggregatedResults,
    currentBranch,
    flags.length > 0 ? flags : undefined
  );

  // Download and compare with base branch coverage (flag-aware)
  const baseCoverage = await artifactManager.downloadBaseCoverageResults(
    baseBranch,
    flags.length > 0 ? flags : undefined
  );
  if (baseCoverage) {
    core.info("🔍 Comparing with base branch coverage...");
    const comparison = CoverageComparator.compareResults(
      baseCoverage,
      aggregatedResults
    );
    aggregatedResults.comparison = comparison;

    // Log comparison summary
    core.info("📈 Coverage Comparison Summary:");
    core.info(
      `  Line Coverage: ${comparison.deltaLineRate >= 0 ? "+" : ""}${
        comparison.deltaLineRate
      }%`
    );
    core.info(
      `  Branch Coverage: ${comparison.deltaBranchRate >= 0 ? "+" : ""}${
        comparison.deltaBranchRate
      }%`
    );
    core.info(`  Files Added: ${comparison.filesAdded.length}`);
    core.info(`  Files Removed: ${comparison.filesRemoved.length}`);
    core.info(`  Files Changed: ${comparison.filesChanged.length}`);
    core.info(
      `  Overall Improvement: ${comparison.improvement ? "Yes" : "No"}`
    );

    // Set comparison outputs
    core.setOutput("coverage-change", comparison.deltaLineRate.toString());
    core.setOutput(
      "branch-coverage-change",
      comparison.deltaBranchRate.toString()
    );
    core.setOutput("coverage-improved", comparison.improvement.toString());
  } else {
    core.info("ℹ️ No base coverage available for comparison");
    core.setOutput("coverage-change", "0");
    core.setOutput("branch-coverage-change", "0");
    core.setOutput("coverage-improved", "false");
  }

  // Set outputs
  core.setOutput("line-coverage", aggregatedResults.lineRate.toString());
  core.setOutput("branch-coverage", aggregatedResults.branchRate.toString());
  core.setOutput("coverage-format", detectedFormat ?? "unknown");

  return aggregatedResults;
}

run();
