import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import type { TimeSeriesDataPoint } from '../types';

interface CoverageChartProps {
  data: TimeSeriesDataPoint[];
}

export function CoverageChart({ data }: CoverageChartProps) {
  const chartData = data
    .filter(d => d.coverage)
    .map(d => ({
      date: format(d.date, 'MMM dd'),
      fullDate: d.date,
      lineRate: d.coverage?.lineRate.toFixed(2),
      branchRate: d.coverage?.branchRate.toFixed(2),
      commitSha: d.commitSha.substring(0, 7),
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        No coverage data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          domain={[0, 100]}
          tick={{ fontSize: 12 }}
          label={{ value: 'Coverage %', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-background border rounded-lg p-3 shadow-lg">
                  <p className="text-sm font-medium mb-1">{payload[0].payload.date}</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {payload[0].payload.commitSha}
                  </p>
                  {payload.map((entry, index) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                      {entry.name}: {entry.value}%
                    </p>
                  ))}
                </div>
              );
            }
            return null;
          }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="lineRate" 
          stroke="#10b981" 
          name="Line Coverage"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
        <Line 
          type="monotone" 
          dataKey="branchRate" 
          stroke="#3b82f6" 
          name="Branch Coverage"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

