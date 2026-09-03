import * as core from "@actions/core";
import * as github from "@actions/github";
import { ReportFormatter } from "../formatters/report-formatter.js";

export class GitHubClient {
  private octokit: ReturnType<typeof github.getOctokit>;
  private context: typeof github.context;

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
    this.context = github.context;
  }

  /**
   * Check if the current context is a pull request
   */
  isPullRequest(): boolean {
    return (
      this.context.eventName === "pull_request" ||
      this.context.eventName === "pull_request_target"
    );
  }

  /**
   * Get the pull request number from context
   */
  getPullRequestNumber(): number | null {
    if (this.context.payload.pull_request) {
      return this.context.payload.pull_request.number;
    }
    return null;
  }

  /**
   * Get the base and head commit SHAs from the pull request context.
   */
  getPullRequestCommitRefs(): {
    baseCommit?: string;
    headCommit?: string;
  } {
    const pullRequest = this.context.payload.pull_request;

    return {
      baseCommit: pullRequest?.base.sha,
      headCommit: pullRequest?.head.sha,
    };
  }

  /**
   * Post or update a comment on the pull request
   */
  async postOrUpdateComment(
    commentBody: string,
    commentKey?: string,
  ): Promise<void> {
    if (!this.isPullRequest()) {
      core.info("Not a pull request context, skipping comment");
      return;
    }

    const prNumber = this.getPullRequestNumber();
    if (!prNumber) {
      core.warning("Could not determine PR number, skipping comment");
      return;
    }

    const { owner, repo } = this.context.repo;
    const identifier = ReportFormatter.getCommentIdentifier(commentKey);

    try {
      // Find existing comment
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
      });

      // Check for both new and legacy identifiers for backward compatibility
      const legacyIdentifier = ReportFormatter.getLegacyCommentIdentifier();
      const existingComment = comments.find(
        (comment) =>
          comment.body?.includes(identifier) ||
          (!commentKey && comment.body?.includes(legacyIdentifier)),
      );

      const fullCommentBody = `${identifier}\n${commentBody}`;

      if (existingComment) {
        // Update existing comment (will upgrade legacy comments to new format)
        core.info(`Updating existing comment (ID: ${existingComment.id})`);
        await this.octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: existingComment.id,
          body: fullCommentBody,
        });
        core.info("Comment updated successfully");
      } else {
        // Create new comment
        core.info("Creating new comment");
        await this.octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: prNumber,
          body: fullCommentBody,
        });
        core.info("Comment created successfully");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      core.warning(`Failed to post/update PR comment: ${message}`);
      // Don't throw - comment posting failure shouldn't fail the action
      // This commonly happens on fork PRs where GITHUB_TOKEN has limited permissions
    }
  }

  /**
   * Get the repository's default branch name via the GitHub API
   */
  async getDefaultBranch(): Promise<string> {
    try {
      const { owner, repo } = this.context.repo;
      const { data } = await this.octokit.rest.repos.get({ owner, repo });
      return data.default_branch;
    } catch (error) {
      core.warning(
        `Failed to detect default branch, falling back to 'main': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return "main";
    }
  }

  /**
   * Get repository and PR information for logging
   */
  getContextInfo(): {
    owner: string;
    repo: string;
    prNumber: number | null;
    eventName: string;
  } {
    return {
      owner: this.context.repo.owner,
      repo: this.context.repo.repo,
      prNumber: this.getPullRequestNumber(),
      eventName: this.context.eventName,
    };
  }

  /**
   * Create a commit status check
   */
  async createCommitStatus(
    context: string,
    state: "success" | "failure" | "pending",
    description: string,
    targetUrl?: string,
  ): Promise<void> {
    const { owner, repo } = this.context.repo;
    const sha = this.context.sha;

    await this.octokit.rest.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state,
      context,
      description,
      target_url: targetUrl,
    });
  }

  /**
   * Get the PR diff content
   */
  async getPrDiff(): Promise<string> {
    const prNumber = this.getPullRequestNumber();
    if (!prNumber) {
      throw new Error("Cannot get PR diff: Not a pull request");
    }

    const { owner, repo } = this.context.repo;
    const { data } = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: {
        format: "diff",
      },
    });

    // The type definition for pulls.get doesn't explicitly include string when mediaType is diff,
    // but the API returns the raw diff string.
    return data as unknown as string;
  }
}
