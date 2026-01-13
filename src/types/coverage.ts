export interface FileCoverage {
  name: string;
  path: string;
  statements: number;
  coveredStatements: number;
  conditionals: number;
  coveredConditionals: number;
  methods: number;
  coveredMethods: number;
  lineRate: number; // Percentage
  branchRate: number; // Percentage
  lines: LineCoverage[];
}

export interface LineCoverage {
  lineNumber: number;
  count: number;
  type: "stmt" | "cond" | "method";
  trueCount?: number;
  falseCount?: number;
}

export interface CoverageMetrics {
  statements: number;
  coveredStatements: number;
  conditionals: number;
  coveredConditionals: number;
  methods: number;
  coveredMethods: number;
  elements: number;
  coveredElements: number;
  lineRate: number; // Percentage
  branchRate: number; // Percentage
}

export interface CoverageResults {
  timestamp: number;
  metrics: CoverageMetrics;
  files: FileCoverage[];
}

export interface AggregatedCoverageResults {
  totalStatements: number;
  coveredStatements: number;
  totalConditionals: number;
  coveredConditionals: number;
  totalMethods: number;
  coveredMethods: number;
  lineRate: number; // Percentage
  branchRate: number; // Percentage
  files: FileCoverage[];
  comparison?: CoverageComparison;
  // Flag metadata for categorizing coverage
  flags?: string[];
  name?: string;
}

export interface FileComparison {
  name: string;
  path: string;
  baseLineRate: number;
  currentLineRate: number;
  baseBranchRate: number;
  currentBranchRate: number;
  deltaLineRate: number;
  deltaBranchRate: number;
  deltaStatements: number;
  deltaCoveredStatements: number;
  deltaConditionals: number;
  deltaCoveredConditionals: number;
}

export interface CoverageComparison {
  filesAdded: FileCoverage[];
  filesRemoved: FileCoverage[];
  filesChanged: FileComparison[];
  deltaLineRate: number;
  deltaBranchRate: number;
  deltaTotalStatements: number;
  deltaCoveredStatements: number;
  deltaTotalConditionals: number;
  deltaCoveredConditionals: number;
  deltaTotalMethods: number;
  deltaCoveredMethods: number;
  improvement: boolean; // Overall improvement in coverage
}

