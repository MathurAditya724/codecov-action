import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportFormatter } from "../formatters/report-formatter.js";
import { GitHubClient } from "../utils/github-client.js";

const listComments = vi.fn();
const updateComment = vi.fn();
const createComment = vi.fn();

vi.mock("@actions/github", () => ({
  getOctokit: () => ({
    rest: {
      issues: { listComments, updateComment, createComment },
    },
  }),
  context: {
    eventName: "pull_request",
    repo: { owner: "owner", repo: "repo" },
    payload: { pull_request: { number: 1 } },
  },
}));

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
}));

describe("GitHubClient.postOrUpdateComment", () => {
  let client: GitHubClient;
  const legacy = ReportFormatter.getLegacyCommentIdentifier();

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GitHubClient("token");
  });

  it("with comment-key set: does not match legacy comment", async () => {
    listComments.mockResolvedValue({
      data: [{ id: 99, body: `${legacy}\nold content` }],
    });

    await client.postOrUpdateComment("new content", "backend");

    expect(updateComment).not.toHaveBeenCalled();
    expect(createComment).toHaveBeenCalledOnce();
  });

  it("without comment-key: matches and updates legacy comment", async () => {
    listComments.mockResolvedValue({
      data: [{ id: 99, body: `${legacy}\nold content` }],
    });

    await client.postOrUpdateComment("new content");

    expect(updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 99 }),
    );
    expect(createComment).not.toHaveBeenCalled();
  });

  it("with comment-key set: matches keyed comment", async () => {
    const keyed = ReportFormatter.getCommentIdentifier("backend");
    listComments.mockResolvedValue({
      data: [{ id: 42, body: `${keyed}\nold content` }],
    });

    await client.postOrUpdateComment("new content", "backend");

    expect(updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 42 }),
    );
    expect(createComment).not.toHaveBeenCalled();
  });
});
