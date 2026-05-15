import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface VelocityDataPoint {
  name: string;
  Velocity: number;
}

interface InventoryVelocityChartProps {
  data: VelocityDataPoint[];
}

export default function InventoryVelocityChart({ data }: InventoryVelocityChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={100} />
        <Tooltip contentStyle={{ borderRadius: "8px" }} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="Velocity" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
