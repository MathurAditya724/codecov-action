export interface RepositoryReference {
  owner: string;
  repo: string;
}

/**
 * Parse a repository shorthand or a URL hosted on github.com.
 */
export function parseRepositoryReference(
  value: string,
): RepositoryReference | null {
  const input = value.trim();
  if (!input) {
    return null;
  }

  const urlInput = input.startsWith("github.com/") ? `https://${input}` : input;

  try {
    const url = new URL(urlInput);
    if (url.hostname !== "github.com") {
      return null;
    }

    const [owner, repo] = url.pathname.split("/").filter(Boolean);
    if (!owner || !repo) {
      return null;
    }

    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    const shorthand = input.match(/^([^/\s]+)\/([^/\s]+)$/);
    if (!shorthand) {
      return null;
    }

    return {
      owner: shorthand[1],
      repo: shorthand[2].replace(/\.git$/, ""),
    };
  }
}
