import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { subDays } from "date-fns";
import type { TimeRange } from "../types";

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

const timeRangeOptions = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 365 },
];

export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  const handleChange = (days: string) => {
    const daysNum = Number.parseInt(days, 10);
    onChange({
      start: subDays(new Date(), daysNum),
      end: new Date(),
    });
  };

  // Find current selected option
  const currentDays = Math.ceil(
    (value.end.getTime() - value.start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const currentOption = timeRangeOptions.find(opt => opt.days === currentDays) 
    || timeRangeOptions[1]; // Default to 30 days

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select 
        value={currentOption.days.toString()} 
        onValueChange={handleChange}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {timeRangeOptions.map((option) => (
            <SelectItem key={option.days} value={option.days.toString()}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

