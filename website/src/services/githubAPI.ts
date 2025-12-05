import { Octokit } from '@octokit/rest';
import { tokenStorage } from './tokenStorage';

class GitHubService {
  private octokit: Octokit;
  
  constructor() {
    const token = tokenStorage.get();
    this.octokit = new Octokit({
      auth: token || undefined,
    });
  }

  private updateOctokit() {
    const token = tokenStorage.get();
    this.octokit = new Octokit({
      auth: token || undefined,
    });
  }

  public setToken(token: string) {
    tokenStorage.set(token);
    this.updateOctokit();
  }

  public removeToken() {
    tokenStorage.remove();
    this.updateOctokit();
  }

  public hasToken(): boolean {
    return tokenStorage.exists();
  }

  // Fetch all branches
  async getBranches(owner: string, repo: string) {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner, 
        repo, 
        per_page: 100
      });
      return data;
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw error;
    }
  }

  // Fetch workflow runs for a specific branch
  async getWorkflowRuns(owner: string, repo: string, branch: string, page = 1) {
    try {
      const { data } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
        owner, 
        repo, 
        branch,
        status: 'success',
        per_page: 50,
        page
      });
      return data.workflow_runs;
    } catch (error) {
      console.error('Error fetching workflow runs:', error);
      throw error;
    }
  }

  // Fetch artifacts for a specific workflow run
  async getRunArtifacts(owner: string, repo: string, runId: number) {
    try {
      const { data } = await this.octokit.rest.actions.listWorkflowRunArtifacts({
        owner, 
        repo, 
        run_id: runId
      });
      return data.artifacts;
    } catch (error) {
      console.error('Error fetching artifacts:', error);
      throw error;
    }
  }

  // Download artifact (returns ArrayBuffer)
  async downloadArtifact(owner: string, repo: string, artifactId: number): Promise<ArrayBuffer> {
    try {
      const { data } = await this.octokit.rest.actions.downloadArtifact({
        owner, 
        repo, 
        artifact_id: artifactId, 
        archive_format: 'zip'
      });
      return data as ArrayBuffer;
    } catch (error) {
      console.error('Error downloading artifact:', error);
      throw error;
    }
  }

  // Check if repository exists
  async checkRepository(owner: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({ owner, repo });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const githubService = new GitHubService();

