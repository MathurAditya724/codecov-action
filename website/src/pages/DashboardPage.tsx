import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Activity } from "lucide-react";
import { BranchSelector } from "../components/BranchSelector";
import { TimeRangeFilter } from "../components/TimeRangeFilter";
import { TokenButton } from "../components/TokenButton";
import { StatCard } from "../components/StatCard";
import { CoverageChart } from "../components/CoverageChart";
import { TestResultsChart } from "../components/TestResultsChart";
import { RunsTable } from "../components/RunsTable";
import { useBranches } from "../hooks/useBranches";
import { useArtifacts } from "../hooks/useArtifacts";
import { githubService } from "../services/githubAPI";
import type { TimeRange } from "../types";

export default function DashboardPage() {
  const { org, repo } = useParams<{ org: string; repo: string }>();
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [timeRange, setTimeRange] = useState<TimeRange>({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [repoExists, setRepoExists] = useState<boolean | null>(null);

  const { branches, loading: branchesLoading, error: branchesError } = useBranches(org, repo);
  const { data, loading: dataLoading, error: dataError } = useArtifacts(org, repo, selectedBranch, timeRange);

  // Check if repository exists
  useEffect(() => {
    async function checkRepo() {
      if (!org || !repo) {
        setRepoExists(false);
        return;
      }

      const exists = await githubService.checkRepository(org, repo);
      setRepoExists(exists);
      
      if (!exists) {
        // Redirect to 404 if repo doesn't exist
        setTimeout(() => navigate("/404", { replace: true }), 2000);
      }
    }

    checkRepo();
  }, [org, repo, navigate]);

  // Update selected branch when branches are loaded
  useEffect(() => {
    if (branches.length > 0 && !branches.find(b => b.name === selectedBranch)) {
      // If "main" doesn't exist, try "master"
      const defaultBranch = branches.find(b => b.name === "master") || branches[0];
      setSelectedBranch(defaultBranch.name);
    }
  }, [branches, selectedBranch]);

  // Calculate stats from latest data point
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const previousData = data.length > 1 ? data[data.length - 2] : null;

  const getStatTrend = (current: number | undefined, previous: number | undefined) => {
    if (!current || !previous) return undefined;
    const diff = current - previous;
    return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  };

  if (repoExists === false) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Repository Not Found</AlertTitle>
          <AlertDescription>
            The repository {org}/{repo} doesn't exist or is not accessible.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (branchesLoading || repoExists === null) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-[400px]" />
          ))}
        </div>
      </div>
    );
  }

  if (branchesError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Repository</AlertTitle>
          <AlertDescription>{branchesError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-8 w-8" />
            <h1 className="text-3xl font-bold">
              {org}/{repo}
            </h1>
          </div>
          <TokenButton />
        </div>
        <div className="flex flex-wrap gap-4 mt-4">
          <BranchSelector
            branches={branches}
            value={selectedBranch}
            onChange={setSelectedBranch}
          />
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
        </div>
      </header>

      {/* Loading State */}
      {dataLoading && (
        <Alert className="mb-6">
          <Activity className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading Data</AlertTitle>
          <AlertDescription>
            Fetching workflow runs and artifacts...
          </AlertDescription>
        </Alert>
      )}

      {/* Error State */}
      {dataError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Data</AlertTitle>
          <AlertDescription>
            {dataError}
            {dataError.includes("401") || dataError.includes("authentication") ? (
              <span className="block mt-2">
                Click the "Setup Token" button in the top-right corner to authenticate.
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      )}

      {/* Empty State */}
      {!dataLoading && data.length === 0 && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Data Available</AlertTitle>
          <AlertDescription>
            No workflow runs with codecov artifacts found for branch "{selectedBranch}" in the selected time range.
            Make sure the codecov action is set up and has run successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      {latestData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Line Coverage"
            value={latestData.coverage ? `${latestData.coverage.lineRate.toFixed(1)}%` : "N/A"}
            trend={getStatTrend(latestData.coverage?.lineRate, previousData?.coverage?.lineRate)}
          />
          <StatCard
            title="Branch Coverage"
            value={latestData.coverage ? `${latestData.coverage.branchRate.toFixed(1)}%` : "N/A"}
            trend={getStatTrend(latestData.coverage?.branchRate, previousData?.coverage?.branchRate)}
          />
          <StatCard
            title="Tests Passed"
            value={latestData.tests ? `${latestData.tests.passed}/${latestData.tests.total}` : "N/A"}
            trend={getStatTrend(latestData.tests?.passed, previousData?.tests?.passed)}
          />
          <StatCard
            title="Pass Rate"
            value={latestData.tests ? `${latestData.tests.passRate.toFixed(1)}%` : "N/A"}
            trend={getStatTrend(latestData.tests?.passRate, previousData?.tests?.passRate)}
          />
        </div>
      )}

      {/* Charts */}
      {data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Coverage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <CoverageChart data={data} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <TestResultsChart data={data} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Runs */}
      {data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <RunsTable data={data} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

