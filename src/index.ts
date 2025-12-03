import * as core from "@actions/core";
import { PRCommentFormatter } from "./formatters/pr-comment-formatter.js";
import { JUnitParser } from "./parsers/junit-parser.js";
import type { TestResults } from "./types/test-results.js";
import { FileFinder } from "./utils/file-finder.js";
import { GitHubClient } from "./utils/github-client.js";

async function run() {
  try {
    core.info("🚀 Starting Codecov Action - Test Results Reporter");

    // Get inputs
    const junitPattern = core.getInput("junit-xml-pattern") || "**/junit.xml";
    const token = core.getInput("token");

    if (!token) {
      throw new Error(
        "GitHub token is required. Please provide 'token' input."
      );
    }

    core.info(`JUnit XML pattern: ${junitPattern}`);

    // Initialize GitHub client
    const githubClient = new GitHubClient(token);
    const contextInfo = githubClient.getContextInfo();
    core.info(
      `Context: ${contextInfo.eventName} in ${contextInfo.owner}/${contextInfo.repo}`
    );

    // Check if running in PR context
    if (!githubClient.isPullRequest()) {
      core.info(
        "Not running in a pull request context. Test results will not be posted as a comment."
      );
      core.info("Continuing with test result parsing for outputs...");
    }

    // Find JUnit XML files
    const fileFinder = new FileFinder();
    const files = await fileFinder.findFiles(junitPattern);

    if (files.length === 0) {
      core.warning(
        `No JUnit XML files found matching pattern: ${junitPattern}`
      );
      core.warning(
        "Please ensure your test framework is generating JUnit XML output."
      );
      core.setOutput("total-tests", "0");
      core.setOutput("passed-tests", "0");
      core.setOutput("failed-tests", "0");
      core.setOutput("test-pass-rate", "0");
      return;
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
        const message =
          error instanceof Error ? error.message : "Unknown error";
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

    // Set outputs
    core.setOutput("total-tests", aggregatedResults.totalTests.toString());
    core.setOutput("passed-tests", aggregatedResults.passedTests.toString());
    core.setOutput("failed-tests", aggregatedResults.failedTests.toString());
    core.setOutput("test-pass-rate", aggregatedResults.passRate.toString());

    // Format and post PR comment
    if (githubClient.isPullRequest()) {
      const formatter = new PRCommentFormatter();
      const commentBody = formatter.formatComment(aggregatedResults);

      core.info("📝 Posting test results to PR comment...");
      await githubClient.postOrUpdateComment(commentBody);
    }

    core.info("✅ Codecov Action completed successfully!");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    core.setFailed(`Action failed: ${message}`);
  }
}

run();
