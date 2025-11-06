import { Card, Group, Text } from "@mantine/core";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; orders: number; revenue: number };

export default function SalesTrendChartInner({ data }: { data: Point[] }) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card
          p="sm"
          radius="md"
          style={{
            background: "rgba(255, 255, 255, 0.98)",
            border: "1px solid #e9ecef",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
          }}
        >
          <Text size="xs" fw={600} mb={4}>
            {payload[0].payload.date}
          </Text>
          {payload.map((entry: any, index: number) => (
            <Group key={index} gap={6}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: entry.color,
                }}
              />
              <Text size="xs" fw={500}>
                {entry.name}: <strong>{entry.value}</strong>
              </Text>
            </Group>
          ))}
        </Card>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#228be6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#228be6" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#40c057" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#40c057" stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#868e96" }} tickLine={false} axisLine={{ stroke: "#e9ecef" }} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12, fill: "#868e96" }}
          tickLine={false}
          axisLine={{ stroke: "#e9ecef" }}
          label={{ value: "Orders", angle: -90, position: "insideLeft", style: { fill: "#868e96", fontSize: 11 } }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12, fill: "#868e96" }}
          tickLine={false}
          axisLine={{ stroke: "#e9ecef" }}
          label={{ value: "Revenue", angle: 90, position: "insideRight", style: { fill: "#868e96", fontSize: 11 } }}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0, 0, 0, 0.02)" }} />
        <Legend
          wrapperStyle={{ paddingTop: "20px" }}
          iconType="rect"
          formatter={(value) => <span style={{ color: "#495057", fontSize: "13px", fontWeight: 500 }}>{value}</span>}
        />
        <Bar yAxisId="left" dataKey="orders" fill="url(#colorOrders)" radius={[8, 8, 0, 0]} barSize={30} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          stroke="#40c057"
          strokeWidth={3}
          dot={{ fill: "#40c057", strokeWidth: 2, r: 5, stroke: "#fff" }}
          activeDot={{ r: 7, strokeWidth: 2, fill: "#40c057" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
