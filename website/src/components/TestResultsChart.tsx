import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { TimeSeriesDataPoint } from '../types';

interface TestResultsChartProps {
  data: TimeSeriesDataPoint[];
}

export function TestResultsChart({ data }: TestResultsChartProps) {
  const chartData = data
    .filter(d => d.tests)
    .map(d => ({
      date: format(d.date, 'MMM dd'),
      passed: d.tests?.passed || 0,
      failed: d.tests?.failed || 0,
      skipped: d.tests?.skipped || 0,
      total: d.tests?.total || 0,
      passRate: d.tests?.passRate.toFixed(1),
      commitSha: d.commitSha.substring(0, 7),
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No test data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          label={{ value: 'Tests', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-medium mb-1">{data.date}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {data.commitSha}
                  </p>
                  <p className="text-sm text-green-600">Passed: {data.passed}</p>
                  <p className="text-sm text-red-600">Failed: {data.failed}</p>
                  <p className="text-sm text-gray-600">Skipped: {data.skipped}</p>
                  <p className="text-sm font-medium mt-1">
                    Pass Rate: {data.passRate}%
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Bar dataKey="passed" fill="#10b981" name="Passed" stackId="a" />
        <Bar dataKey="failed" fill="#ef4444" name="Failed" stackId="a" />
        <Bar dataKey="skipped" fill="#94a3b8" name="Skipped" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}

