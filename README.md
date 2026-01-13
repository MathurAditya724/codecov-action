# Codecov Action

## Quick Start

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run tests with coverage
        run: npm test -- --coverage
      
      - name: Codecov Action
        uses: mathuraditya724/codecov-action@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token for API access and artifact storage | **Yes** | — |
| `junit-xml-pattern` | Glob pattern for finding JUnit XML test result files | No | `./**/*.junit.xml` |
| `coverage-xml-pattern` | Glob pattern for finding Clover XML coverage files | No | `./**/clover.xml` |
| `base-branch` | Base branch to compare results against | No | `main` |
| `enable-tests` | Enable test results reporting | No | `true` |
| `enable-coverage` | Enable coverage reporting | No | `true` |
| `post-pr-comment` | Post results as a PR comment (in addition to Job Summary) | No | `false` |

## Outputs

### Test Outputs

| Output | Description |
|--------|-------------|
| `total-tests` | Total number of tests run |
| `passed-tests` | Number of passed tests |
| `failed-tests` | Number of failed tests |
| `test-pass-rate` | Percentage of tests that passed |
| `tests-added` | Number of tests added compared to base branch |
| `tests-removed` | Number of tests removed compared to base branch |
| `tests-fixed` | Number of tests that changed from failing to passing |
| `tests-broken` | Number of tests that changed from passing to failing |

### Coverage Outputs

| Output | Description |
|--------|-------------|
| `line-coverage` | Line coverage percentage |
| `branch-coverage` | Branch coverage percentage |
| `coverage-change` | Change in line coverage compared to base branch |
| `branch-coverage-change` | Change in branch coverage compared to base branch |
| `coverage-improved` | Whether coverage improved compared to base branch (`true`/`false`) |

## Usage Examples

### Basic Usage (Tests + Coverage)

```yaml
- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Coverage Only

```yaml
- name: Coverage Report
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    enable-tests: false
    enable-coverage: true
```

### Tests Only with PR Comments

```yaml
- name: Test Results
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    enable-tests: true
    enable-coverage: false
    post-pr-comment: true
```

### Custom File Patterns

```yaml
- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    junit-xml-pattern: './test-results/**/*.xml'
    coverage-xml-pattern: './coverage/clover.xml'
```

### Using Outputs for Coverage Gate

```yaml
- name: Codecov Action
  id: codecov
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}

- name: Check coverage threshold
  run: |
    if [ "${{ steps.codecov.outputs.line-coverage }}" -lt "80" ]; then
      echo "Coverage is below 80%!"
      exit 1
    fi

- name: Fail on broken tests
  if: steps.codecov.outputs.tests-broken != '0'
  run: |
    echo "Tests were broken in this PR!"
    exit 1
```

### Compare Against Different Base Branch

```yaml
- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    base-branch: develop
```

## How It Works

### 1. File Discovery

The action searches for test result and coverage files using the configured glob patterns:

- **JUnit XML** files for test results (default: `./**/*.junit.xml`)
- **Clover XML** files for coverage data (default: `./**/clover.xml`)

### 2. Parsing & Aggregation

Multiple files matching the patterns are parsed and aggregated into unified results:

- Test results include pass/fail counts, execution time, and failure details
- Coverage results include line, branch, and method coverage percentages

### 3. Artifact Storage

Results are uploaded as GitHub Artifacts with branch-specific naming:

- `test-results-{branch}` — Aggregated test results
- `coverage-results-{branch}` — Aggregated coverage data

This enables comparison across workflow runs without any external service.

### 4. Base Branch Comparison

When running on a PR or feature branch:

1. The action downloads the latest results artifact from the base branch
2. Compares current results against the baseline
3. Calculates deltas (tests added/removed/fixed/broken, coverage changes)

### 5. Reporting

Results are displayed in two ways:

- **Job Summary** — Always generated, visible in the Actions run UI
- **PR Comment** — Optional, posts/updates a comment on the pull request

## Supported Formats

### Test Results

| Format | Typical File | Common Test Frameworks |
|--------|--------------|----------------------|
| JUnit XML | `*.junit.xml`, `junit.xml` | Jest, Vitest, Mocha, pytest, JUnit, NUnit, PHPUnit |

Most test frameworks support JUnit XML output. Example configurations:

**Jest / Vitest:**
```json
{
  "reporters": ["default", ["jest-junit", { "outputFile": "report.junit.xml" }]]
}
```

**pytest:**
```bash
pytest --junitxml=report.junit.xml
```

### Coverage

| Format | Typical File | Common Coverage Tools |
|--------|--------------|----------------------|
| Clover XML | `clover.xml` | Istanbul/NYC (JS/TS), PHPUnit, OpenClover |

**Jest / Vitest with Istanbul:**
```json
{
  "coverageReporters": ["clover", "text"]
}
```

## Report Examples

### Job Summary

The Job Summary appears in the GitHub Actions UI and includes:

- **Test Results** — Total/passed/failed/skipped counts with pass rate
- **Coverage Report** — Line, branch, and method coverage percentages
- **Comparison Data** — Changes from base branch (if available)
- **Failed Tests** — Detailed failure information with stack traces
- **Low Coverage Files** — Files with coverage below 50%

### PR Comment

When `post-pr-comment: true` is set, a comment is posted/updated on the PR:

```markdown
## Codecov Action Results 📊

## Test Results 🧪

✅ **42 passed** | ❌ **2 failed** | ⏭️ **1 skipped** | **Total: 45** | **Pass Rate: 93.33%**

⏱️ **Execution Time:** 12.34s

### 📊 Comparison with Base Branch

| Metric | Change |
|--------|--------|
| Total Tests | 📈 +5 |
| Passed Tests | 📈 +3 |
| Failed Tests | 📉 -1 |

## Coverage Report 🎯

| Metric | Coverage | Covered/Total |
|--------|----------|---------------|
| 🟢 **Line Coverage** | **85.2%** | 1024/1202 |
| 🟡 **Branch Coverage** | **72.5%** | 145/200 |
| 🔧 **Method Coverage** | **90.1%** | 82/91 |

### 📊 Coverage Change from Base Branch

#### 📈 Coverage Improved!

| Metric | Change |
|--------|--------|
| Line Coverage | +2.30% |
| Branch Coverage | +1.50% |
```

## Permissions

The action requires the following permissions:

```yaml
permissions:
  contents: read        # Read repository contents
  actions: read         # Read workflow runs and artifacts
  pull-requests: write  # Post PR comments (if enabled)
```
