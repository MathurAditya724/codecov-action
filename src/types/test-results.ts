export interface TestCase {
  classname: string;
  name: string;
  time: number;
  failure?: TestFailure;
  skipped?: boolean;
}

export interface TestFailure {
  message: string;
  type?: string;
  content?: string; // Stack trace or error details
}

export interface TestSuite {
  name: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testcases: TestCase[];
}

export interface TestResults {
  name?: string;
  tests: number;
  failures: number;
  errors: number;
  skipped: number;
  time: number;
  testsuites: TestSuite[];
}

export interface AggregatedTestResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  totalTime: number;
  passRate: number;
  failedTestCases: Array<{
    suiteName: string;
    testCase: TestCase;
  }>;
}
