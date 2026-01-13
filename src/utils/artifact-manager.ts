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
   * Generate artifact name for a branch
   */
  private getArtifactName(
    branchName: string,
    type: "test" | "coverage" = "test",
    flags?: string[]
  ): string {
    const sanitized = this.sanitizeBranchName(branchName);
    const baseName = `codecov-${type}-results-${sanitized}`;

    // Add flag suffix if flags are provided
    if (flags && flags.length > 0) {
      const flagSuffix = flags
        .map((f) => this.sanitizeBranchName(f))
        .join("-");
      return `${baseName}-${flagSuffix}`;
    }

    return baseName;
  }

  /**
   * Upload test results as an artifact
   */
  async uploadResults(
    results: AggregatedTestResults,
    branchName: string
  ): Promise<void> {
    try {
      const artifactName = this.getArtifactName(branchName, "test");
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
        tmpDir
      );

      core.info(
        `✅ Test artifact uploaded successfully. ID: ${uploadResult.id}`
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
   */
  async uploadCoverageResults(
    results: AggregatedCoverageResults,
    branchName: string,
    flags?: string[]
  ): Promise<void> {
    try {
      const artifactName = this.getArtifactName(branchName, "coverage", flags);
      core.info(`📤 Uploading coverage results as artifact: ${artifactName}`);

      if (flags && flags.length > 0) {
        core.info(`   Flags: ${flags.join(", ")}`);
      }

      // Create a temporary directory for the artifact
      const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "codecov-coverage-")
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
        tmpDir
      );

      core.info(
        `✅ Coverage artifact uploaded successfully. ID: ${uploadResult.id}`
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
   * Download test results from a base branch artifact using GitHub API
   */
  async downloadBaseResults(
    baseBranch: string
  ): Promise<AggregatedTestResults | null> {
    try {
      const artifactName = this.getArtifactName(baseBranch, "test");
      core.info(`📥 Attempting to download base test results: ${artifactName}`);

      // Find the latest successful workflow run on the base branch
      const workflowRuns =
        await this.octokit.rest.actions.listWorkflowRunsForRepo({
          owner: this.owner,
          repo: this.repo,
          branch: baseBranch,
          status: "success",
          per_page: 10,
        });

      if (workflowRuns.data.workflow_runs.length === 0) {
        core.info(
          `ℹ️ No successful workflow runs found for branch '${baseBranch}'`
        );
        return null;
      }

      // Look through recent runs for the artifact
      for (const run of workflowRuns.data.workflow_runs) {
        const artifacts =
          await this.octokit.rest.actions.listWorkflowRunArtifacts({
            owner: this.owner,
            repo: this.repo,
            run_id: run.id,
          });

        const artifact = artifacts.data.artifacts.find(
          (a) => a.name === artifactName && !a.expired
        );

        if (artifact) {
          core.info(`Found test artifact from run #${run.run_number}`);

          // Download the artifact
          const download = await this.octokit.rest.actions.downloadArtifact({
            owner: this.owner,
            repo: this.repo,
            artifact_id: artifact.id,
            archive_format: "zip",
          });

          // Create temp directory and save the zip
          const tmpDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "codecov-base-test-")
          );
          const zipPath = path.join(tmpDir, "artifact.zip");

          // The download is a buffer, write it to file
          fs.writeFileSync(zipPath, Buffer.from(download.data as ArrayBuffer));

          // Extract and read the results
          const results = this.extractAndReadResults(zipPath, tmpDir);

          // Clean up
          fs.unlinkSync(zipPath);
          fs.rmSync(tmpDir, { recursive: true });

          return results;
        }
      }

      core.info(
        `ℹ️ No artifact '${artifactName}' found in recent workflow runs`
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
   */
  async downloadBaseCoverageResults(
    baseBranch: string,
    flags?: string[]
  ): Promise<AggregatedCoverageResults | null> {
    try {
      // First try to find flagged artifact if flags are provided
      const flaggedArtifactName = this.getArtifactName(
        baseBranch,
        "coverage",
        flags
      );
      const unflaggedArtifactName = this.getArtifactName(baseBranch, "coverage");

      const artifactNamesToTry =
        flags && flags.length > 0
          ? [flaggedArtifactName, unflaggedArtifactName] // Try flagged first, then unflagged
          : [unflaggedArtifactName];

      core.info(
        `📥 Attempting to download base coverage results: ${artifactNamesToTry[0]}`
      );

      if (flags && flags.length > 0) {
        core.info(`   Looking for flags: ${flags.join(", ")}`);
      }

      // Find the latest successful workflow run on the base branch
      const workflowRuns =
        await this.octokit.rest.actions.listWorkflowRunsForRepo({
          owner: this.owner,
          repo: this.repo,
          branch: baseBranch,
          status: "success",
          per_page: 10,
        });

      if (workflowRuns.data.workflow_runs.length === 0) {
        core.info(
          `ℹ️ No successful workflow runs found for branch '${baseBranch}'`
        );
        return null;
      }

      // Look through recent runs for the artifact
      for (const run of workflowRuns.data.workflow_runs) {
        const artifacts =
          await this.octokit.rest.actions.listWorkflowRunArtifacts({
            owner: this.owner,
            repo: this.repo,
            run_id: run.id,
          });

        // Try to find artifact with each name in order of preference
        for (const artifactName of artifactNamesToTry) {
          const artifact = artifacts.data.artifacts.find(
            (a) => a.name === artifactName && !a.expired
          );

          if (artifact) {
            core.info(
              `Found coverage artifact '${artifactName}' from run #${run.run_number}`
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
              path.join(os.tmpdir(), "codecov-base-coverage-")
            );
            const zipPath = path.join(tmpDir, "artifact.zip");

            // The download is a buffer, write it to file
            fs.writeFileSync(
              zipPath,
              Buffer.from(download.data as ArrayBuffer)
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
        `ℹ️ No artifact '${artifactNamesToTry[0]}' found in recent workflow runs`
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
    extractDir: string
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
    extractDir: string
  ): AggregatedCoverageResults | null {
    try {
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(extractDir, true);

      const resultsFile = path.join(extractDir, "coverage-results.json");

      if (!fs.existsSync(resultsFile)) {
        core.warning(
          "Downloaded artifact does not contain coverage-results.json"
        );
        return null;
      }

      const resultsContent = fs.readFileSync(resultsFile, "utf-8");
      const results = JSON.parse(resultsContent) as AggregatedCoverageResults;

      core.info(
        "✅ Base coverage results downloaded and extracted successfully"
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
