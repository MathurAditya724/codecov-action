import * as core from "@actions/core";
import { PRCommentFormatter } from "./formatters/pr-comment-formatter.js";
import { CoverageParser } from "./parsers/coverage-parser.js";
import { JUnitParser } from "./parsers/junit-parser.js";
import type { CoverageResults } from "./types/coverage.js";
import type { TestResults } from "./types/test-results.js";
import { ArtifactManager } from "./utils/artifact-manager.js";
import { TestResultsComparator } from "./utils/comparison.js";
import { CoverageComparator } from "./utils/coverage-comparison.js";
import { FileFinder } from "./utils/file-finder.js";
import { GitHubClient } from "./utils/github-client.js";
import { writeJobSummary } from "./utils/summary-writer.js";

async function run() {
  try {
    // Get inputs
    const junitPattern =
      core.getInput("junit-xml-pattern") || "./**/*.junit.xml";
    const coveragePattern =
      core.getInput("coverage-xml-pattern") || "./**/clover.xml";
    const token = core.getInput("token");
    const baseBranch = core.getInput("base-branch") || "main";
    const enableTests = core.getBooleanInput("enable-tests") !== false;
    const enableCoverage = core.getBooleanInput("enable-coverage") !== false;
    const postPrComment = core.getBooleanInput("post-pr-comment") === true;

    if (!token) {
      throw new Error(
        "GitHub token is required. Please provide 'token' input."
      );
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
        coveragePattern,
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
 * Process coverage results
 */
async function processCoverage(
  coveragePattern: string,
  artifactManager: ArtifactManager,
  currentBranch: string,
  baseBranch: string
) {
  core.info("🎯 Processing coverage results...");

  // Find coverage XML files
  const fileFinder = new FileFinder();
  const files = await fileFinder.findFiles(coveragePattern);

  if (files.length === 0) {
    core.warning(
      `No coverage XML files found matching pattern: ${coveragePattern}`
    );
    core.warning(
      "Please ensure your test framework is generating Clover XML coverage output."
    );
    core.setOutput("line-coverage", "0");
    core.setOutput("branch-coverage", "0");
    core.setOutput("coverage-change", "0");
    return null;
  }

  // Validate files
  const validFiles = fileFinder.validateFiles(files);
  if (validFiles.length === 0) {
    throw new Error("No valid coverage XML files found");
  }

  core.info(`Processing ${validFiles.length} coverage XML file(s)`);

  // Parse all coverage XML files
  const parser = new CoverageParser();
  const allResults: CoverageResults[] = [];

  for (const file of validFiles) {
    try {
      core.info(`Parsing coverage: ${file}`);
      const result = await parser.parseFile(file);
      allResults.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.error(`Failed to parse ${file}: ${message}`);
      // Continue with other files
    }
  }

  if (allResults.length === 0) {
    throw new Error("Failed to parse any coverage XML files");
  }

  // Aggregate results
  const aggregatedResults = CoverageParser.aggregateResults(allResults);

  core.info("🎯 Coverage Summary:");
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

  // Upload current coverage as artifact
  await artifactManager.uploadCoverageResults(aggregatedResults, currentBranch);

  // Download and compare with base branch coverage
  const baseCoverage = await artifactManager.downloadBaseCoverageResults(
    baseBranch
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

  return aggregatedResults;
}

run();
