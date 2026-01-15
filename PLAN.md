# Codecov GitHub Action - Technical Implementation Plan

## Executive Summary

Build a GitHub Action that provides code coverage reporting, PR comments with coverage diffs, configurable status checks, and historical comparison - all without external dependencies, using GitHub's native capabilities (Artifacts, Commit Status API, PR Comments).

---

## Architecture Overview

The action will be structured as a **JavaScript/TypeScript GitHub Action** with the following core modules:

```
src/
├── index.ts                    # Main entry point
├── parsers/                    # Coverage format parsers
│   ├── coverage-parser.ts      # Unified parser interface
│   ├── clover-parser.ts        # Clover XML
│   ├── cobertura-parser.ts     # Cobertura XML
│   ├── lcov-parser.ts          # LCOV format
│   └── json-parser.ts          # Istanbul JSON, coverage-final.json
├── analyzers/
│   ├── patch-analyzer.ts       # Git diff + coverage intersection
│   └── threshold-checker.ts    # Coverage threshold validation
├── reporters/
│   ├── pr-comment.ts           # PR comment formatting
│   └── status-check.ts         # GitHub commit status API
├── storage/
│   └── artifact-manager.ts     # Upload/download coverage artifacts
├── config/
│   └── config-loader.ts        # YAML configuration loader
└── types/
    └── index.ts                # TypeScript interfaces
```

---

## Phase 1: Multi-Format Coverage Parsing

### 1.1 Supported Formats

Implement parsers for the most common coverage report formats:

| Format | File Pattern | Languages |

|--------|--------------|-----------|

| Clover XML | `clover.xml` | PHP, Java, JS/TS (Istanbul) |

| Cobertura XML | `coverage.xml`, `cobertura.xml` | Python, Java, .NET |

| LCOV | `lcov.info`, `*.lcov` | C/C++, JS/TS, Go |

| Istanbul JSON | `coverage-final.json` | JS/TS |

### 1.2 Unified Coverage Model

Extend the existing types in [`src/types/coverage.ts`](src/types/coverage.ts) with a normalized internal format:

```typescript
interface NormalizedCoverage {
  files: Map<string, FileCoverage>;
  summary: CoverageSummary;
  format: 'clover' | 'cobertura' | 'lcov' | 'istanbul';
  timestamp: number;
}

interface CoverageSummary {
  lines: { covered: number; total: number; percentage: number };
  branches: { covered: number; total: number; percentage: number };
  functions: { covered: number; total: number; percentage: number };
  statements: { covered: number; total: number; percentage: number };
}
```

### 1.3 Implementation Tasks

- Add Cobertura XML parser (most common for Python/Java projects)
- Add LCOV parser (widely used, especially for C/C++ and Go)
- Add Istanbul JSON parser (for JS/TS projects using Jest/NYC)
- Create unified `CoverageParser` factory that auto-detects format
- Refactor existing Clover parser in [`src/parsers/coverage-parser.ts`](src/parsers/coverage-parser.ts) to implement the unified interface

---

## Phase 2: Patch Coverage Analysis

### 2.1 Git Diff Integration

Implement "patch coverage" - the percentage of **changed lines** that are covered by tests. This is Codecov's most valuable metric.

```typescript
interface PatchCoverage {
  addedLines: number;
  coveredAddedLines: number;
  percentage: number;
  fileBreakdown: Array<{
    path: string;
    addedLines: number[];
    coveredLines: number[];
    uncoveredLines: number[];
  }>;
}
```

### 2.2 Implementation Approach

1. **Get PR diff** using `@actions/github`:
   ```typescript
   const { data: diff } = await octokit.rest.pulls.get({
     owner, repo, pull_number,
     mediaType: { format: 'diff' }
   });
   ```

2. **Parse diff** to extract added lines per file (use `parse-diff` npm package)

3. **Intersect with coverage data** to determine which added lines are covered

4. **Calculate patch coverage percentage**: `coveredAddedLines / totalAddedLines * 100`

### 2.3 Files to Modify/Create

- Create `src/analyzers/patch-analyzer.ts` - Git diff parsing and coverage intersection
- Update [`src/formatters/pr-comment-formatter.ts`](src/formatters/pr-comment-formatter.ts) to display patch coverage prominently

---

## Phase 3: Configurable Status Checks

### 3.1 Status Check Types

Implement two types of status checks (matching Codecov's model):

| Check Type | Description | Comparison Base |

|------------|-------------|-----------------|

| **Project** | Overall repository coverage | Configurable target or auto (base branch) |

| **Patch** | Coverage of changed lines only | Configurable threshold (default: 100%) |

### 3.2 Configuration Schema

Create a `codecov.yml` equivalent configuration file (`.github/coverage.yml`):

```yaml
coverage:
  status:
    project:
      default:
        target: auto      # 'auto' uses base branch, or specify percentage
        threshold: 1%     # Allow 1% drop before failing
        informational: false
    patch:
      default:
        target: 80%       # Require 80% of changed lines covered
        informational: false

  # Future: flags support
  # flags:
  #   frontend:
  #     paths: ["src/frontend/**"]
  #   backend:
  #     paths: ["src/backend/**"]
```

### 3.3 Status Check Implementation

Use GitHub's Commit Status API via `@actions/github`:

```typescript
await octokit.rest.repos.createCommitStatus({
  owner,
  repo,
  sha: context.sha,
  state: 'success' | 'failure' | 'pending',
  context: 'coverage/project',
  description: 'Coverage: 85.2% (+1.3%)',
  target_url: undefined // Could link to artifact or GH Pages in future
});
```

### 3.4 Files to Create

- Create `src/config/config-loader.ts` - Parse `.github/coverage.yml`
- Create `src/analyzers/threshold-checker.ts` - Evaluate coverage against thresholds
- Create `src/reporters/status-check.ts` - Post commit statuses

---

## Phase 4: Enhanced PR Comments

### 4.1 Comment Layout

Design a comprehensive PR comment matching Codecov's format:

````markdown
## Coverage Report

> **Patch Coverage**: 87.5% of changed lines covered

| Totals | Coverage | Delta |
|--------|----------|-------|
| Lines | 82.4% | +1.2% |
| Branches | 76.1% | -0.3% |

<details>
<summary>Files changed (5)</summary>

| File | Coverage | Lines | +/- |
|------|----------|-------|-----|
| src/parser.ts | 95.2% | 42 | +5.2% |
| src/utils.ts | 65.0% | 20 | -2.1% |
...
</details>

<details>
<summary>Uncovered lines in changed files</summary>

**src/utils.ts**
```diff
+ 45: function uncoveredFn() {  // NOT COVERED
+ 46:   return null;            // NOT COVERED
+ 47: }
`` `
</details>
````

### 4.2 Implementation

Enhance [`src/formatters/pr-comment-formatter.ts`](src/formatters/pr-comment-formatter.ts):

- Add patch coverage section (most prominent)
- Add file-level breakdown with delta indicators
- Add collapsible "uncovered lines in diff" section
- Add project/patch status indicator icons

---

## Phase 5: Artifact-Based Storage and Comparison

### 5.1 Storage Strategy

Store coverage data as GitHub Artifacts with branch-based naming:

```
Artifact Name: coverage-{branch-name-sanitized}
Contents:
 - coverage.json (normalized coverage data)
 - metadata.json (commit SHA, timestamp, run ID)
```

### 5.2 Comparison Flow

```
1. Run tests, generate coverage report
2. Parse coverage into normalized format
3. Upload as artifact: "coverage-{current-branch}"
4. If PR context:
   a. Download artifact: "coverage-{base-branch}" from latest successful run
   b. Compare current vs base coverage
   c. Calculate deltas
   d. Generate patch coverage from PR diff
5. Post PR comment with comparison
6. Set commit statuses based on thresholds
```

### 5.3 Cross-Workflow Artifact Access

The existing [`src/utils/artifact-manager.ts`](src/utils/artifact-manager.ts) already implements cross-run artifact download. Enhancements needed:

- Add artifact versioning/deduplication
- Implement artifact retention management (keep last N per branch)
- Add fallback to parent commit if base branch artifact missing

---

## Phase 6: Action Interface

### 6.1 Action Inputs

Update [`action.yml`](action.yml) with comprehensive inputs:

```yaml
inputs:
  # Required
  token:
    description: 'GitHub token for API access'
    required: true
  
  # Coverage files
  coverage-files:
    description: 'Glob pattern for coverage files'
    default: '**/coverage*.xml,**/lcov.info,**/coverage-final.json'
  
  # Behavior
  fail-on-threshold:
    description: 'Fail the action if coverage thresholds not met'
    default: 'true'
  
  # Status checks
  project-threshold:
    description: 'Minimum project coverage percentage'
    default: 'auto'  # Use base branch as target
  
  patch-threshold:
    description: 'Minimum patch coverage percentage'
    default: '80'
  
  # Comparison
  base-branch:
    description: 'Branch to compare against'
    default: 'main'
  
  # Comment
  post-pr-comment:
    description: 'Post coverage comment on PR'
    default: 'false'
```

### 6.2 Action Outputs

```yaml
outputs:
  coverage-percentage:
    description: 'Overall line coverage percentage'
  patch-coverage:
    description: 'Patch coverage percentage (changed lines only)'
  coverage-delta:
    description: 'Change in coverage from base branch'
  status:
    description: 'Overall status (pass/fail)'
  report-url:
    description: 'URL to detailed report (if generated)'
```

---

## Implementation Order

| Order | Phase | Priority | Dependencies |

|-------|-------|----------|--------------|

| 1 | Multi-format parsers | High | None |

| 2 | Config loader | High | None |

| 3 | Threshold checker | High | Config loader |

| 4 | Status check reporter | High | Threshold checker |

| 5 | Patch coverage analyzer | High | Parsers |

| 6 | Enhanced PR comments | Medium | Patch analyzer |

| 7 | Artifact optimization | Low | Existing artifact manager |

---

## Testing Strategy

1. **Unit tests** for each parser with fixture files
2. **Integration tests** with real GitHub API (using mocks for CI)
3. **End-to-end tests** in a test repository with real PRs
4. **Coverage format test suite** with sample files from popular frameworks:

                                                                                                                                                                                                                                                                                                                                                                                                - Jest (Istanbul JSON, Clover)
                                                                                                                                                                                                                                                                                                                                                                                                - Pytest (Cobertura)
                                                                                                                                                                                                                                                                                                                                                                                                - Go (LCOV)
                                                                                                                                                                                                                                                                                                                                                                                                - Java/Gradle (Jacoco/Cobertura)

---

## Key Differentiators from Codecov

| Feature | Codecov | Our Action |

|---------|---------|------------|

| External service | Yes (SaaS) | No - runs in GitHub Actions |

| Data storage | Codecov servers | GitHub Artifacts |

| Dashboard | Web UI | PR comments + GitHub Actions UI |

| Historical trends | Full history | 90-day artifact retention |

| Token management | Codecov tokens | GitHub token only |

| Privacy | Data on Codecov | Data stays in GitHub |

---

## Future Enhancements (Post-MVP)

1. **Flags/Components** - Categorize coverage by path patterns
2. **Carryforward** - Carry forward coverage from unchanged files
3. **GitHub Pages Dashboard** - Static site with historical trends