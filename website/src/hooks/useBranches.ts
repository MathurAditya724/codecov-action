import { useState, useEffect } from 'react';
import { githubService } from '../services/githubAPI';
import type { Branch } from '../types';

export function useBranches(owner: string | undefined, repo: string | undefined) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!owner || !repo) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchBranches() {
      if (!owner || !repo) return;

      try {
        setLoading(true);
        setError(null);
        const data = await githubService.getBranches(owner, repo);
        
        if (!cancelled) {
          setBranches(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch branches');
          setBranches([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchBranches();

    return () => {
      cancelled = true;
    };
  }, [owner, repo]);
  
  return { branches, loading, error };
}

