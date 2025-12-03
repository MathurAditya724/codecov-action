import * as core from "@actions/core";
import * as github from "@actions/github";
import { PRCommentFormatter } from "../formatters/pr-comment-formatter.js";

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
	 * Post or update a comment on the pull request
	 */
	async postOrUpdateComment(commentBody: string): Promise<void> {
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
		const identifier = PRCommentFormatter.getCommentIdentifier();

		try {
			// Find existing comment
			const { data: comments } = await this.octokit.rest.issues.listComments({
				owner,
				repo,
				issue_number: prNumber,
			});

			const existingComment = comments.find((comment) =>
				comment.body?.includes(identifier),
			);

			const fullCommentBody = `${identifier}\n${commentBody}`;

			if (existingComment) {
				// Update existing comment
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
			const message =
				error instanceof Error ? error.message : "Unknown error";
			core.error(`Failed to post/update PR comment: ${message}`);
			throw new Error(`GitHub API error: ${message}`);
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
}

