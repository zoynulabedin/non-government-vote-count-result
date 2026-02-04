import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

const data = [
  { name: "Yes Vote", value: 65, color: "#22c55e" }, // Green
  { name: "No Vote", value: 35, color: "#ef4444" }, // Red
];

export function YesNoChart() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-80 flex flex-col">
      <h3 className="text-lg font-bold text-slate-800 mb-2 border-b pb-2">
        Public Referendum Results
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => [`${value}%`]}
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
              }}
            />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-center mt-2">
        <p className="text-sm text-slate-500">
          Total Count:{" "}
          <span className="font-bold text-slate-900">15,420,100</span>
        </p>
      </div>
    </div>
  );
}
