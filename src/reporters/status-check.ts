import * as core from "@actions/core";
import { GitHubClient } from "../utils/github-client.js";

export class StatusReporter {
  private client: GitHubClient;

  constructor(token: string) {
    this.client = new GitHubClient(token);
  }

  /**
   * Report status check to GitHub
   */
  async reportStatus(
    context: string,
    state: "success" | "failure" | "pending",
    description: string,
    targetUrl?: string
  ): Promise<void> {
    try {
      // Use the exposed octokit instance and context info from GitHubClient
      // We need to access private properties or extend GitHubClient to support this.
      // Since GitHubClient wraps octokit and doesn't expose it directly in the current implementation,
      // we'll rely on a new method we'll need to add to GitHubClient, or use the existing patterns.
      
      // Checking GitHubClient implementation first...
      // It seems we need to extend GitHubClient to support createCommitStatus
      await this.client.createCommitStatus(context, state, description, targetUrl);
      
      core.info(`✅ Reported status '${context}': ${state} - ${description}`);
    } catch (error) {
      core.warning(
        `Failed to report status '${context}': ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
