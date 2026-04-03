import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { DefaultArtifactClient } from "@actions/artifact";
import * as core from "@actions/core";
import { getOctokit } from "@actions/github";
import AdmZip from "adm-zip";
import type { AggregatedCoverageResults } from "../types/coverage.js";
import type { AggregatedTestResults } from "../types/test-results.js";

/**
 * Workflow run conclusions we consider valid for downloading base artifacts.
 * We accept "success" and "failure" because a workflow can have overall
 * "failure" conclusion due to unrelated jobs while the job that uploaded
 * the coverage artifact succeeded. We exclude "cancelled", "timed_out",
 * "action_required", and "stale" as those may have incomplete artifacts.
 */
const VALID_RUN_CONCLUSIONS = new Set(["success", "failure"]);

/**
 * Manages artifact upload and download for test results comparison
 */
export class ArtifactManager {
  private artifactClient = new DefaultArtifactClient();
  private octokit;
  private owner: string;
  private repo: string;

  constructor(token: string) {
    this.octokit = getOctokit(token);
    // Get repository info from environment
    const repository = process.env.GITHUB_REPOSITORY || "";
    const [owner, repo] = repository.split("/");
    this.owner = owner || "";
    this.repo = repo || "";
  }

  /**
   * Sanitize branch name to be used in artifact name
   */
  private sanitizeBranchName(branchName: string): string {
    // Replace special characters with hyphens
    return branchName.replace(/[^a-zA-Z0-9-_]/g, "-");
  }

  /**
   * Generate artifact name for a branch.
   * Includes GITHUB_JOB to avoid conflicts when multiple jobs in the same
   * workflow run invoke the action.
   */
  private getArtifactName(
    branchName: string,
    type: "test" | "coverage" = "test",
    flags?: string[],
    name?: string,
  ): string {
    const sanitized = this.sanitizeBranchName(branchName);
    const jobId = process.env.GITHUB_JOB
      ? `-${this.sanitizeBranchName(process.env.GITHUB_JOB)}`
      : "";
    let artifactName = `codecov-${type}-results-${sanitized}${jobId}`;

    // Add name suffix if provided (useful for matrix builds to avoid conflicts)
    if (name) {
      artifactName += `-${this.sanitizeBranchName(name)}`;
    }

    // Add flag suffix if flags are provided
    if (flags && flags.length > 0) {
      const flagSuffix = flags.map((f) => this.sanitizeBranchName(f)).join("-");
      artifactName += `-${flagSuffix}`;
    }

    return artifactName;
  }

  /**
   * Generate artifact name WITHOUT the job ID suffix (for backwards-compatible
   * fallback when downloading from older workflow runs).
   */
  private getLegacyArtifactName(
    branchName: string,
    type: "test" | "coverage" = "test",
    flags?: string[],
    name?: string,
  ): string {
    const sanitized = this.sanitizeBranchName(branchName);
    let artifactName = `codecov-${type}-results-${sanitized}`;

    if (name) {
      artifactName += `-${this.sanitizeBranchName(name)}`;
    }

    if (flags && flags.length > 0) {
      const flagSuffix = flags.map((f) => this.sanitizeBranchName(f)).join("-");
      artifactName += `-${flagSuffix}`;
    }

    return artifactName;
  }

  /**
   * Upload test results as an artifact
   */
  async uploadResults(
    results: AggregatedTestResults,
    branchName: string,
    name?: string,
  ): Promise<void> {
    try {
      const artifactName = this.getArtifactName(
        branchName,
        "test",
        undefined,
        name,
      );
      core.info(`📤 Uploading test results as artifact: ${artifactName}`);

      // Create a temporary directory for the artifact
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codecov-test-"));
      const resultsFile = path.join(tmpDir, "test-results.json");

      // Write results to file (without the comparison field to avoid circular data)
      const { comparison: _comparison, ...resultsToSave } = results;
      fs.writeFileSync(resultsFile, JSON.stringify(resultsToSave, null, 2));

      // Upload the artifact
      const uploadResult = await this.artifactClient.uploadArtifact(
        artifactName,
        [resultsFile],
        tmpDir,
      );

      core.info(
        `✅ Test artifact uploaded successfully. ID: ${uploadResult.id}`,
      );

      // Clean up temporary file
      fs.unlinkSync(resultsFile);
      fs.rmdirSync(tmpDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to upload test artifact: ${message}`);
      // Don't throw - artifact upload failure shouldn't fail the action
    }
  }

  /**
   * Upload coverage results as an artifact
   * @param results The coverage results to upload
   * @param branchName The branch name for the artifact
   * @param flags Optional flags to tag this coverage upload
   * @param name Optional name to differentiate uploads (e.g., in matrix builds)
   */
  async uploadCoverageResults(
    results: AggregatedCoverageResults,
    branchName: string,
    flags?: string[],
    name?: string,
  ): Promise<void> {
    try {
      const artifactName = this.getArtifactName(
        branchName,
        "coverage",
        flags,
        name,
      );
      core.info(`📤 Uploading coverage results as artifact: ${artifactName}`);

      if (flags && flags.length > 0) {
        core.info(`   Flags: ${flags.join(", ")}`);
      }

      // Create a temporary directory for the artifact
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "codecov-coverage-"),
      );
      const resultsFile = path.join(tmpDir, "coverage-results.json");

      // Write results to file (without the comparison field to avoid circular data)
      // Include flags and name metadata in the saved results
      const { comparison: _comparison, ...resultsToSave } = results;
      fs.writeFileSync(resultsFile, JSON.stringify(resultsToSave, null, 2));

      // Upload the artifact
      const uploadResult = await this.artifactClient.uploadArtifact(
        artifactName,
        [resultsFile],
        tmpDir,
      );

      core.info(
        `✅ Coverage artifact uploaded successfully. ID: ${uploadResult.id}`,
      );

      // Clean up temporary file
      fs.unlinkSync(resultsFile);
      fs.rmdirSync(tmpDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to upload coverage artifact: ${message}`);
      // Don't throw - artifact upload failure shouldn't fail the action
    }
  }

  /**
   * Fetch valid completed workflow runs, optionally trying a specific commit
   * SHA first and falling back to the base branch.
   */
  private async fetchValidWorkflowRuns(
    baseBranch: string,
    baseSha?: string,
  ) {
    // If a specific SHA was requested, try it first
    if (baseSha) {
      core.info(`   Looking for specific commit SHA: ${baseSha}`);
      const shaResponse =
        await this.octokit.rest.actions.listWorkflowRunsForRepo({
          owner: this.owner,
          repo: this.repo,
          head_sha: baseSha,
          status: "completed",
          per_page: 10,
        });
      const shaRuns = shaResponse.data.workflow_runs.filter(
        (r) => r.conclusion && VALID_RUN_CONCLUSIONS.has(r.conclusion),
      );
      if (shaRuns.length > 0) {
        return shaRuns;
      }
      core.info(
        `ℹ️ No completed workflow runs found for SHA '${baseSha}'. Falling back to branch '${baseBranch}'`,
      );
    }

    // Fall back to branch-based lookup
    const branchResponse =
      await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner: this.owner,
        repo: this.repo,
        branch: baseBranch,
        status: "completed",
        per_page: 10,
      });
    return branchResponse.data.workflow_runs.filter(
      (r) => r.conclusion && VALID_RUN_CONCLUSIONS.has(r.conclusion),
    );
  }

  /**
   * Download test results from a base branch artifact using GitHub API
   */
  async downloadBaseResults(
    baseBranch: string,
    name?: string,
    baseSha?: string,
  ): Promise<AggregatedTestResults | null> {
    try {
      const artifactName = this.getArtifactName(
        baseBranch,
        "test",
        undefined,
        name,
      );
      const legacyArtifactName = this.getLegacyArtifactName(
        baseBranch,
        "test",
        undefined,
        name,
      );
      const unflaggedArtifactName = this.getArtifactName(baseBranch, "test");
      const legacyUnflaggedArtifactName = this.getLegacyArtifactName(
        baseBranch,
        "test",
      );

      const artifactNamesToTry = [
        ...new Set([
          artifactName,
          unflaggedArtifactName,
          legacyArtifactName,
          legacyUnflaggedArtifactName,
        ]),
      ];

      core.info(
        `📥 Attempting to download base test results: ${artifactNamesToTry[0]}`,
      );

      const validRuns = await this.fetchValidWorkflowRuns(baseBranch, baseSha);

      if (validRuns.length === 0) {
        core.info(
          `ℹ️ No completed workflow runs found for branch '${baseBranch}'`,
        );
        return null;
      }

      // Look through recent runs for the artifact
      for (const run of validRuns) {
        const artifacts =
          await this.octokit.rest.actions.listWorkflowRunArtifacts({
            owner: this.owner,
            repo: this.repo,
            run_id: run.id,
          });

        for (const nameToTry of artifactNamesToTry) {
          const artifact = artifacts.data.artifacts.find(
            (a) => a.name === nameToTry && !a.expired,
          );

          if (artifact) {
            core.info(
              `Found test artifact '${nameToTry}' from run #${run.run_number}`,
            );

            // Download the artifact
            const download = await this.octokit.rest.actions.downloadArtifact({
              owner: this.owner,
              repo: this.repo,
              artifact_id: artifact.id,
              archive_format: "zip",
            });

            // Create temp directory and save the zip
            const tmpDir = fs.mkdtempSync(
              path.join(os.tmpdir(), "codecov-base-test-"),
            );
            const zipPath = path.join(tmpDir, "artifact.zip");

            // The download is a buffer, write it to file
            fs.writeFileSync(
              zipPath,
              Buffer.from(download.data as ArrayBuffer),
            );

            // Extract and read the results
            const results = this.extractAndReadResults(zipPath, tmpDir);

            // Clean up
            fs.unlinkSync(zipPath);
            fs.rmSync(tmpDir, { recursive: true });

            return results;
          }
        }
      }

      core.info(
        `ℹ️ No artifact '${artifactNamesToTry[0]}' found in recent workflow runs`,
      );
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to download base test artifact: ${message}`);
      return null;
    }
  }

  /**
   * Download coverage results from a base branch artifact using GitHub API
   * @param baseBranch The base branch to download from
   * @param flags Optional flags to match specific flagged coverage
   * @param name Optional name to match specific named coverage (e.g., from matrix builds)
   * @param baseSha Optional specific commit SHA to look for first
   */
  async downloadBaseCoverageResults(
    baseBranch: string,
    flags?: string[],
    name?: string,
    baseSha?: string,
  ): Promise<AggregatedCoverageResults | null> {
    try {
      // Build a list of artifact names to try, in order of preference:
      // 1. Flagged/named with job ID (current format)
      // 2. Unflagged with job ID
      // 3. Flagged/named without job ID (legacy format)
      // 4. Unflagged without job ID (legacy format)
      const flaggedArtifactName = this.getArtifactName(
        baseBranch,
        "coverage",
        flags,
        name,
      );
      const unflaggedArtifactName = this.getArtifactName(
        baseBranch,
        "coverage",
      );
      const legacyFlaggedArtifactName = this.getLegacyArtifactName(
        baseBranch,
        "coverage",
        flags,
        name,
      );
      const legacyUnflaggedArtifactName = this.getLegacyArtifactName(
        baseBranch,
        "coverage",
      );

      const artifactNamesToTry = [
        ...new Set([
          flaggedArtifactName,
          unflaggedArtifactName,
          legacyFlaggedArtifactName,
          legacyUnflaggedArtifactName,
        ]),
      ];

      core.info(
        `📥 Attempting to download base coverage results: ${artifactNamesToTry[0]}`,
      );

      if (flags && flags.length > 0) {
        core.info(`   Looking for flags: ${flags.join(", ")}`);
      }

      const validRuns = await this.fetchValidWorkflowRuns(baseBranch, baseSha);

      if (validRuns.length === 0) {
        core.info(
          `ℹ️ No completed workflow runs found for branch '${baseBranch}'`,
        );
        return null;
      }

      // Look through recent runs for the artifact
      for (const run of validRuns) {
        const artifacts =
          await this.octokit.rest.actions.listWorkflowRunArtifacts({
            owner: this.owner,
            repo: this.repo,
            run_id: run.id,
          });

        // Try to find artifact with each name in order of preference
        for (const artifactName of artifactNamesToTry) {
          const artifact = artifacts.data.artifacts.find(
            (a) => a.name === artifactName && !a.expired,
          );

          if (artifact) {
            core.info(
              `Found coverage artifact '${artifactName}' from run #${run.run_number}`,
            );

            // Download the artifact
            const download = await this.octokit.rest.actions.downloadArtifact({
              owner: this.owner,
              repo: this.repo,
              artifact_id: artifact.id,
              archive_format: "zip",
            });

            // Create temp directory and save the zip
            const tmpDir = fs.mkdtempSync(
              path.join(os.tmpdir(), "codecov-base-coverage-"),
            );
            const zipPath = path.join(tmpDir, "artifact.zip");

            // The download is a buffer, write it to file
            fs.writeFileSync(
              zipPath,
              Buffer.from(download.data as ArrayBuffer),
            );

            // Extract and read the coverage results
            const results = this.extractAndReadCoverageResults(zipPath, tmpDir);

            // Clean up
            fs.unlinkSync(zipPath);
            fs.rmSync(tmpDir, { recursive: true });

            return results;
          }
        }
      }

      core.info(
        `ℹ️ No artifact '${artifactNamesToTry[0]}' found in recent workflow runs`,
      );
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to download base coverage artifact: ${message}`);
      return null;
    }
  }

  /**
   * Extract zip and read test results
   */
  private extractAndReadResults(
    zipPath: string,
    extractDir: string,
  ): AggregatedTestResults | null {
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);

      const resultsFile = path.join(extractDir, "test-results.json");

      if (!fs.existsSync(resultsFile)) {
        core.warning("Downloaded artifact does not contain test-results.json");
        return null;
      }

      const resultsContent = fs.readFileSync(resultsFile, "utf-8");
      const results = JSON.parse(resultsContent) as AggregatedTestResults;

      core.info("✅ Base test results downloaded and extracted successfully");
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to extract test artifact: ${message}`);
      return null;
    }
  }

  /**
   * Extract zip and read coverage results
   */
  private extractAndReadCoverageResults(
    zipPath: string,
    extractDir: string,
  ): AggregatedCoverageResults | null {
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);

      const resultsFile = path.join(extractDir, "coverage-results.json");

      if (!fs.existsSync(resultsFile)) {
        core.warning(
          "Downloaded artifact does not contain coverage-results.json",
        );
        return null;
      }

      const resultsContent = fs.readFileSync(resultsFile, "utf-8");
      const results = JSON.parse(resultsContent) as AggregatedCoverageResults;

      core.info(
        "✅ Base coverage results downloaded and extracted successfully",
      );
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to extract coverage artifact: ${message}`);
      return null;
    }
  }

  /**
   * Get the current branch name from the GitHub context
   */
  static getCurrentBranch(): string {
    // Try to get from GITHUB_REF
    const ref = process.env.GITHUB_REF || "";

    if (ref.startsWith("refs/heads/")) {
      return ref.replace("refs/heads/", "");
    }

    if (ref.startsWith("refs/pull/")) {
      // For PRs, use the head ref
      return process.env.GITHUB_HEAD_REF || "unknown";
    }

    return "unknown";
  }
}
