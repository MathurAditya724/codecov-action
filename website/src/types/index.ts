export interface TimeSeriesDataPoint {
  date: Date;
  commitSha: string;
  runId: number;
  runNumber: number;
  coverage?: {
    lineRate: number;
    branchRate: number;
    totalStatements: number;
    coveredStatements: number;
    totalConditionals: number;
    coveredConditionals: number;
    totalMethods: number;
    coveredMethods: number;
  };
  tests?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    passRate: number;
    totalTime: number;
  };
}

export interface Branch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ParsedArtifact {
  tests?: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    skippedTests: number;
    passRate: number;
    totalTime: number;
  };
  coverage?: {
    lineRate: number;
    branchRate: number;
    totalStatements: number;
    coveredStatements: number;
    totalConditionals: number;
    coveredConditionals: number;
    totalMethods: number;
    coveredMethods: number;
  };
}

