import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChartData {
  name: string;
  votes: number;
  color?: string;
  fill?: string;
}

interface NationalChartProps {
  data?: ChartData[];
  title?: string;
}

const defaultData = [
  { name: 'BNP', votes: 120450, color: '#22c55e' }, // Green
  { name: 'AL', votes: 98000, color: '#ef4444' },   // Red
  { name: 'Jamat', votes: 45000, color: '#0ea5e9' }, // Blue
  { name: 'JP', votes: 12000, color: '#eab308' },    // Yellow
  { name: 'Ind', votes: 5000, color: '#64748b' },    // Slate
];

export function NationalChart({ data = defaultData, title = "National Vote Distribution" }: NationalChartProps) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md h-96">
      <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">{title}</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{fill: '#475569'}} axisLine={false} tickLine={false} />
          <YAxis tick={{fill: '#475569'}} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`} />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}}
            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
          />
          <Bar dataKey="votes" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill || entry.color || '#64748b'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
