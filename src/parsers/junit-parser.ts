import { XMLParser } from "fast-xml-parser";
import * as fs from "node:fs";
import type {
  AggregatedTestResults,
  TestCase,
  TestResults,
  TestSuite,
} from "../types/test-results.js";

export class JUnitParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      textNodeName: "#text",
      parseAttributeValue: true,
    });
  }

  /**
   * Parse a JUnit XML file and return structured test results
   */
  parseFile(filePath: string): TestResults {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return this.parseXML(fileContent);
  }

  /**
   * Parse JUnit XML content and return structured test results
   */
  parseXML(xmlContent: string): TestResults {
    const parsed = this.parser.parse(xmlContent);

    // Handle both <testsuites> and single <testsuite> root elements
    if (parsed.testsuites) {
      return this.parseTestSuites(parsed.testsuites);
    }
    if (parsed.testsuite) {
      // Single test suite - wrap it
      const suite = this.parseTestSuite(parsed.testsuite);
      return {
        tests: suite.tests,
        failures: suite.failures,
        errors: suite.errors,
        skipped: suite.skipped,
        time: suite.time,
        testsuites: [suite],
      };
    }

    throw new Error("Invalid JUnit XML: missing testsuites or testsuite root");
  }

  /**
   * Parse multiple test suites
   */
  private parseTestSuites(testsuites: any): TestResults {
    const suites = Array.isArray(testsuites.testsuite)
      ? testsuites.testsuite
      : [testsuites.testsuite];

    const parsedSuites = suites
      .filter((suite) => suite) // Filter out undefined
      .map((suite) => this.parseTestSuite(suite));

    return {
      name: testsuites["@_name"],
      tests: testsuites["@_tests"] || 0,
      failures: testsuites["@_failures"] || 0,
      errors: testsuites["@_errors"] || 0,
      skipped: testsuites["@_skipped"] || 0,
      time: testsuites["@_time"] || 0,
      testsuites: parsedSuites,
    };
  }

  /**
   * Parse a single test suite
   */
  private parseTestSuite(testsuite: any): TestSuite {
    let testcases: TestCase[] = [];

    if (testsuite.testcase) {
      const cases = Array.isArray(testsuite.testcase)
        ? testsuite.testcase
        : [testsuite.testcase];
      testcases = cases.map((tc) => this.parseTestCase(tc));
    }

    return {
      name: testsuite["@_name"] || "Unknown Suite",
      tests: testsuite["@_tests"] || 0,
      failures: testsuite["@_failures"] || 0,
      errors: testsuite["@_errors"] || 0,
      skipped: testsuite["@_skipped"] || 0,
      time: testsuite["@_time"] || 0,
      testcases,
    };
  }

  /**
   * Parse a single test case
   */
  private parseTestCase(testcase: any): TestCase {
    const result: TestCase = {
      classname: testcase["@_classname"] || "Unknown Class",
      name: testcase["@_name"] || "Unknown Test",
      time: testcase["@_time"] || 0,
    };

    // Check for failure
    if (testcase.failure) {
      result.failure = {
        message: testcase.failure["@_message"] || "Test failed",
        type: testcase.failure["@_type"],
        content: testcase.failure["#text"] || testcase.failure,
      };
    }

    // Check for skipped
    if (testcase.skipped !== undefined) {
      result.skipped = true;
    }

    return result;
  }

  /**
   * Aggregate results from multiple test files
   */
  static aggregateResults(results: TestResults[]): AggregatedTestResults {
    let totalTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let totalTime = 0;
    const failedTestCases: Array<{
      suiteName: string;
      testCase: TestCase;
    }> = [];

    for (const result of results) {
      for (const suite of result.testsuites) {
        totalTests += suite.tests;
        failedTests += suite.failures + suite.errors;
        skippedTests += suite.skipped;
        totalTime += suite.time;

        // Collect failed test cases
        for (const testcase of suite.testcases) {
          if (testcase.failure) {
            failedTestCases.push({
              suiteName: suite.name,
              testCase: testcase,
            });
          }
        }
      }
    }

    const passedTests = totalTests - failedTests - skippedTests;
    const passRate =
      totalTests > 0
        ? Number(((passedTests / totalTests) * 100).toFixed(2))
        : 0;

    return {
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      totalTime,
      passRate,
      failedTestCases,
    };
  }
}
