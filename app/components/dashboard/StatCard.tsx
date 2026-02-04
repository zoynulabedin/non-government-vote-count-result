import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { clsx } from "clsx";

interface StatCardProps {
  partyName: string;
  voteCount: number;
  percentage: number;
  color: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  logoUrl?: string;
}

export function StatCard({ partyName, voteCount, percentage, color, trend = "neutral", trendValue }: StatCardProps) {
  return (
    <div className={clsx("bg-white rounded-lg shadow-md p-4 border-t-4", color)}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-bold text-lg text-slate-800">{partyName}</h3>
        {trend === "up" && <div className="flex items-center text-green-600 text-xs font-bold"><ArrowUp className="h-3 w-3 mr-1" />{trendValue}</div>}
        {trend === "down" && <div className="flex items-center text-red-600 text-xs font-bold"><ArrowDown className="h-3 w-3 mr-1" />{trendValue}</div>}
        {trend === "neutral" && <div className="flex items-center text-slate-400 text-xs font-bold"><Minus className="h-3 w-3 mr-1" />{trendValue}</div>}
      </div>
      
      <div className="flex items-end justify-between">
        <div>
          <div className="text-3xl font-extrabold text-slate-900">{voteCount.toLocaleString()}</div>
          <div className="text-sm text-slate-500 font-medium mt-1">Total Votes</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-700">{percentage}%</div>
          <div className="text-xs text-slate-400">Share</div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mt-4 w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div 
          className={clsx("h-2.5 rounded-full", color.replace("border-", "bg-"))} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
