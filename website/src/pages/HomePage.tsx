import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, Github, TrendingUp, FileCode, CheckCircle } from "lucide-react";
import { TokenButton } from "../components/TokenButton";

export default function HomePage() {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse repo URL or owner/repo format
    let owner = "";
    let repo = "";
    
    // Try to extract from various formats
    if (repoUrl.includes("github.com/")) {
      const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
      if (match) {
        owner = match[1];
        repo = match[2].replace(/\.git$/, "");
      }
    } else if (repoUrl.includes("/")) {
      [owner, repo] = repoUrl.split("/").map(s => s.trim());
    }
    
    if (owner && repo) {
      navigate(`/${owner}/${repo}`);
    }
  };

  const exampleRepos = [
    { owner: "mathuraditya724", repo: "codecov-action" },
    { owner: "facebook", repo: "react" },
    { owner: "microsoft", repo: "typescript" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="py-12">
          <div className="flex justify-end mb-4">
            <TokenButton />
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Activity className="h-12 w-12" />
              <h1 className="text-5xl font-bold">Codecov Dashboard</h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              View test results and code coverage metrics from your GitHub repositories
            </p>
          </div>
        </div>

        {/* Search Card */}
        <Card className="max-w-2xl mx-auto mb-12">
          <CardHeader>
            <CardTitle>View Repository Coverage</CardTitle>
            <CardDescription>
              Enter a GitHub repository to view its coverage and test results over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="owner/repo or github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">
                <Github className="h-4 w-4 mr-2" />
                View
              </Button>
            </form>
            
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Examples:</p>
              <div className="flex flex-wrap gap-2">
                {exampleRepos.map((repo) => (
                  <Button
                    key={`${repo.owner}/${repo.repo}`}
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/${repo.owner}/${repo.repo}`)}
                  >
                    {repo.owner}/{repo.repo}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <TrendingUp className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Track Coverage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualize line and branch coverage trends across multiple workflow runs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CheckCircle className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Monitor test pass rates, failures, and new tests added over time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <FileCode className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Branch Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Compare coverage across different branches with customizable time ranges
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>
            This dashboard works with public repositories using the{" "}
            <a
              href="https://github.com/mathuraditya724/codecov-action"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              codecov-action
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

