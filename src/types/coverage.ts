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
  // Detailed line tracking for reporting
  missingLines?: number[]; // Line numbers with 0 hits
  partialLines?: number[]; // Line numbers with partial branch coverage
  patchCoverage?: number; // Coverage % for changed lines only (if applicable)
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
  // Detailed aggregate metrics for reporting
  totalHits?: number; // Total lines with hits > 0
  totalMisses?: number; // Total lines with 0 hits
  totalPartials?: number; // Total lines with partial branch coverage
  totalBranches?: number; // Total branch count
  totalFiles?: number; // Total number of files
  totalLines?: number; // Total number of lines tracked
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
  // Detailed line tracking
  missingLines?: number;
  partialLines?: number;
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
  // Detailed comparison metrics
  deltaFiles?: number;
  deltaLines?: number;
  deltaBranches?: number;
  deltaHits?: number;
  deltaMisses?: number;
  deltaPartials?: number;
  // Base/head reference info
  baseBranch?: string;
  headCommit?: string;
  baseCommit?: string;
  // Base metrics for diff table
  baseFiles?: number;
  baseLines?: number;
  baseBranches?: number;
  baseHits?: number;
  baseMisses?: number;
  basePartials?: number;
  // Current metrics for diff table
  currentFiles?: number;
  currentLines?: number;
  currentBranches?: number;
  currentHits?: number;
  currentMisses?: number;
  currentPartials?: number;
}

