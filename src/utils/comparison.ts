import type {
  AggregatedTestResults,
  TestCase,
  TestChange,
  TestComparison,
  TestIdentifier,
} from "../types/test-results.js";

/**
 * Generate a unique key for a test case
 */
function generateTestKey(
  suiteName: string,
  classname: string,
  testName: string
): string {
  return `${suiteName}::${classname}::${testName}`;
}

/**
 * Build a map of all tests from aggregated results
 */
function buildTestMap(
  results: AggregatedTestResults
): Map<
  string,
  { identifier: TestIdentifier; testCase: TestCase; isPassing: boolean }
> {
  const testMap = new Map();

  // Add all failed tests
  for (const { suiteName, testCase } of results.failedTestCases) {
    const key = generateTestKey(suiteName, testCase.classname, testCase.name);
    testMap.set(key, {
      identifier: {
        suiteName,
        classname: testCase.classname,
        testName: testCase.name,
      },
      testCase,
      isPassing: false,
    });
  }

  // We need to infer passing tests from the total count
  // This is a limitation - we don't have explicit passing test data in the current structure
  // For now, we'll only track failed tests and changes in failed tests

  return testMap;
}

/**
 * Utility class for comparing test results between branches
 */
export const TestResultsComparator = {
  /**
   * Compare two test result sets and generate a comparison report
   */
  compareResults(
    baseResults: AggregatedTestResults,
    currentResults: AggregatedTestResults
  ): TestComparison {
    const baseTestMap = buildTestMap(baseResults);
    const currentTestMap = buildTestMap(currentResults);

    const testsAdded: TestChange[] = [];
    const testsRemoved: TestChange[] = [];
    const testsBroken: TestChange[] = [];
    const testsFixed: TestChange[] = [];

    // Build a set of all test keys from both base and current
    const allTestKeys = new Set([
      ...Array.from(baseTestMap.keys()),
      ...Array.from(currentTestMap.keys()),
    ]);

    // Compare each test
    for (const key of allTestKeys) {
      const baseTest = baseTestMap.get(key);
      const currentTest = currentTestMap.get(key);

      if (!baseTest && currentTest) {
        // Test exists in current but not in base
        if (!currentTest.isPassing) {
          // New test that is failing
          testsAdded.push({
            identifier: currentTest.identifier,
            testCase: currentTest.testCase,
          });
        }
      } else if (baseTest && !currentTest) {
        // Test exists in base but not in current
        if (!baseTest.isPassing) {
          // Test was failing and now removed (or fixed)
          testsRemoved.push({
            identifier: baseTest.identifier,
            testCase: baseTest.testCase,
          });
        }
      } else if (baseTest && currentTest) {
        // Test exists in both - check if status changed
        if (baseTest.isPassing && !currentTest.isPassing) {
          // Test was passing, now failing (regression)
          testsBroken.push({
            identifier: currentTest.identifier,
            testCase: currentTest.testCase,
          });
        } else if (!baseTest.isPassing && currentTest.isPassing) {
          // Test was failing, now passing (improvement)
          testsFixed.push({
            identifier: currentTest.identifier,
            testCase: currentTest.testCase,
          });
        }
      }
    }

    // Calculate deltas
    const deltaTotal = currentResults.totalTests - baseResults.totalTests;
    const deltaPassed = currentResults.passedTests - baseResults.passedTests;
    const deltaFailed = currentResults.failedTests - baseResults.failedTests;
    const deltaSkipped = currentResults.skippedTests - baseResults.skippedTests;

    return {
      testsAdded,
      testsRemoved,
      testsBroken,
      testsFixed,
      deltaTotal,
      deltaPassed,
      deltaFailed,
      deltaSkipped,
    };
  },

  /**
   * Check if there are any significant changes
   */
  hasSignificantChanges(comparison: TestComparison): boolean {
    return (
      comparison.testsAdded.length > 0 ||
      comparison.testsRemoved.length > 0 ||
      comparison.testsBroken.length > 0 ||
      comparison.testsFixed.length > 0 ||
      comparison.deltaTotal !== 0
    );
  },
};
