import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: string | number;
  subtitle?: string;
}

export function StatCard({ title, value, trend, subtitle }: StatCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    const trendNum = typeof trend === 'string' ? parseFloat(trend) : trend;
    
    if (trendNum > 0) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (trendNum < 0) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    
    const trendNum = typeof trend === 'string' ? parseFloat(trend) : trend;
    
    if (trendNum > 0) return "text-green-600";
    if (trendNum < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{trend}</span>
          </div>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

