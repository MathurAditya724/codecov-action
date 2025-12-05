/**
 * Service for managing GitHub Personal Access Token storage
 */

const TOKEN_KEY = 'github_access_token';

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  remove(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  exists(): boolean {
    return this.get() !== null;
  }
};

