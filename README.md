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

## Supported Coverage Formats

| Format | File Patterns | Languages/Tools |
|--------|--------------|-----------------|
| **Clover XML** | `clover.xml` | Istanbul/NYC (JS/TS), PHPUnit, OpenClover |
| **Cobertura XML** | `coverage.xml`, `cobertura.xml` | coverage.py (Python), Coverlet (.NET), PHPUnit |
| **JaCoCo XML** | `jacoco.xml` | Java, Kotlin, Scala |
| **LCOV** | `lcov.info`, `*.lcov` | c8, lcov (C/C++), grcov (Rust), gcov |
| **Istanbul JSON** | `coverage-final.json` | Jest, Vitest, NYC (JS/TS) |
| **Go Coverage** | `coverage.out`, `cover.out` | `go test -coverprofile` |

## Inputs

### Core Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token for API access and artifacts | **Yes** | — |
| `base-branch` | Base branch to compare results against | No | `main` |
| `enable-tests` | Enable test results reporting | No | `true` |
| `enable-coverage` | Enable coverage reporting | No | `true` |
| `post-pr-comment` | Post results as a PR comment | No | `false` |

### Coverage File Discovery (Codecov-style)

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `files` | Comma-separated list of coverage files | No | — |
| `directory` | Folder to search for coverage files | No | `.` |
| `exclude` | Comma-separated patterns to exclude | No | — |
| `coverage-format` | Format hint: `auto`, `clover`, `cobertura`, `jacoco`, `lcov`, `istanbul`, `go` | No | `auto` |
| `disable-search` | Disable auto-search, use only explicit `files` | No | `false` |

### Behavior Flags (Codecov-style)

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `fail-ci-if-error` | Exit with non-zero code on failure | No | `false` |
| `handle-no-reports-found` | Don't fail if no coverage found | No | `false` |
| `verbose` | Enable verbose logging | No | `false` |

### Grouping & Identification

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `flags` | Comma-separated flags to tag coverage (e.g., `unittests,frontend`) | No | — |
| `name` | Custom name for this coverage upload | No | — |

### Test Results

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `junit-xml-pattern` | Glob pattern for JUnit XML files | No | `./**/*.junit.xml` |

## Outputs

### Test Outputs

| Output | Description |
|--------|-------------|
| `total-tests` | Total number of tests run |
| `passed-tests` | Number of passed tests |
| `failed-tests` | Number of failed tests |
| `test-pass-rate` | Percentage of tests that passed |
| `tests-added` | Tests added compared to base branch |
| `tests-removed` | Tests removed compared to base branch |
| `tests-fixed` | Tests changed from failing to passing |
| `tests-broken` | Tests changed from passing to failing |

### Coverage Outputs

| Output | Description |
|--------|-------------|
| `line-coverage` | Line coverage percentage |
| `branch-coverage` | Branch coverage percentage |
| `coverage-change` | Change in line coverage vs base branch |
| `branch-coverage-change` | Change in branch coverage vs base branch |
| `coverage-improved` | Whether coverage improved (`true`/`false`) |
| `coverage-format` | The detected/used coverage format |

## Usage Examples

### Basic Usage (Auto-detect)

```yaml
- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
```

### Explicit Files (Codecov-style)

```yaml
- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    files: ./coverage/lcov.info,./backend/coverage.xml
    disable-search: true
    flags: unittests
    name: my-coverage
    verbose: true
```

### Python with Cobertura

```yaml
- name: Run tests
  run: pytest --cov=src --cov-report=xml

- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    directory: ./
    coverage-format: cobertura
    fail-ci-if-error: true
```

### Java with JaCoCo

```yaml
- name: Build and test
  run: ./gradlew test jacocoTestReport

- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    files: ./build/reports/jacoco/test/jacocoTestReport.xml
    coverage-format: jacoco
```

### Go Coverage

```yaml
- name: Run tests
  run: go test -coverprofile=coverage.out ./...

- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    files: ./coverage.out
    coverage-format: go
```

### JavaScript/TypeScript with LCOV

```yaml
- name: Run tests
  run: npm test -- --coverage --coverageReporters=lcov

- name: Codecov Action
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    directory: ./coverage
    coverage-format: lcov
```

### Monorepo with Flags

```yaml
- name: Frontend Coverage
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    directory: ./frontend/coverage
    flags: frontend
    name: frontend-coverage

- name: Backend Coverage
  uses: mathuraditya724/codecov-action@v1
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    directory: ./backend/coverage
    flags: backend
    name: backend-coverage
```

### Coverage Gate with Threshold

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

## How It Works

### 1. File Discovery

The action searches for coverage files using:
- **Explicit files**: If `files` input is provided
- **Auto-discovery**: Searches `directory` for known coverage file patterns
- **Format detection**: Auto-detects format from file content

### 2. Parsing & Aggregation

Multiple coverage files are parsed and aggregated:
- Supports mixing formats (e.g., frontend LCOV + backend Cobertura)
- Calculates unified line, branch, and method coverage

### 3. Artifact Storage

Results are stored as GitHub Artifacts:
- `coverage-results-{branch}` — Aggregated coverage data
- `test-results-{branch}` — Aggregated test results

### 4. Base Branch Comparison

On PRs or feature branches:
1. Downloads latest results from base branch
2. Compares current vs baseline
3. Calculates deltas

### 5. Reporting

- **Job Summary**: Always generated in Actions UI
- **PR Comment**: Optional detailed comment on PRs

## Test Results

### Supported Format

| Format | Typical File | Common Test Frameworks |
|--------|--------------|----------------------|
| JUnit XML | `*.junit.xml` | Jest, Vitest, Mocha, pytest, JUnit, NUnit, PHPUnit |

### Configuration Examples

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

## Coverage Configuration Examples

### JavaScript/TypeScript (Jest/Vitest)

```json
{
  "coverageReporters": ["lcov", "clover", "json"]
}
```

### Python (pytest-cov)

```bash
pytest --cov=src --cov-report=xml  # Cobertura format
```

### Java (Gradle + JaCoCo)

```groovy
jacocoTestReport {
    reports {
        xml.required = true
    }
}
```

### Go

```bash
go test -coverprofile=coverage.out ./...
```

### .NET (Coverlet)

```bash
dotnet test --collect:"XPlat Code Coverage"
# or
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura
```

## Permissions

```yaml
permissions:
  contents: read        # Read repository contents
  actions: read         # Read workflow runs and artifacts
  pull-requests: write  # Post PR comments (if enabled)
```

## Migration from Codecov

If you're migrating from the official Codecov action:

| Codecov Input | This Action |
|---------------|-------------|
| `fail_ci_if_error` | `fail-ci-if-error` |
| `files` | `files` |
| `directory` | `directory` |
| `exclude` | `exclude` |
| `flags` | `flags` |
| `name` | `name` |
| `verbose` | `verbose` |
| `handle-no-reports-found` | `handle-no-reports-found` |

**Note**: This action doesn't require a Codecov token—it uses GitHub's native artifacts for storage.

## Author

**Aditya Mathur**
