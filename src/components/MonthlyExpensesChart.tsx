import { useQuery } from "convex/react";
import { TrendingUp } from "lucide-react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { api } from "../../convex/_generated/api";

export function MonthlyExpensesChart() {
	const monthlyData = useQuery(api.expenses.getMonthlyTotals);

	if (monthlyData === undefined) {
		return (
			<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
				<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
					<TrendingUp className="w-6 h-6" />
					Monthly Shared Expenses
				</h2>
				<div className="h-64 flex items-center justify-center">
					<p className="text-gray-400">Loading chart data...</p>
				</div>
			</div>
		);
	}

	if (monthlyData.length === 0) {
		return (
			<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
				<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
					<TrendingUp className="w-6 h-6" />
					Monthly Shared Expenses
				</h2>
				<div className="h-64 flex items-center justify-center">
					<p className="text-gray-400">
						No expense data yet. Upload statements to see your spending trends.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
			<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
				<TrendingUp className="w-6 h-6" />
				Monthly Shared Expenses
			</h2>

			<ResponsiveContainer width="100%" height={300}>
				<LineChart data={monthlyData}>
					<CartesianGrid strokeDasharray="3 3" stroke="#475569" opacity={0.3} />
					<XAxis
						dataKey="label"
						stroke="#94a3b8"
						tick={{ fill: "#94a3b8", fontSize: 12 }}
						angle={-45}
						textAnchor="end"
						height={80}
					/>
					<YAxis
						stroke="#94a3b8"
						tick={{ fill: "#94a3b8", fontSize: 12 }}
						tickFormatter={(value) => `$${value}`}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "#1e293b",
							border: "1px solid #475569",
							borderRadius: "8px",
							color: "#fff",
						}}
						formatter={(value: number) => [`$${value.toFixed(2)}`, "Shared"]}
						labelStyle={{ color: "#94a3b8" }}
					/>
					<Line
						type="monotone"
						dataKey="total"
						stroke="#06b6d4"
						strokeWidth={2}
						dot={{ fill: "#06b6d4", r: 4 }}
						activeDot={{ r: 6, fill: "#06b6d4" }}
					/>
				</LineChart>
			</ResponsiveContainer>

			<div className="mt-4 text-sm text-gray-400 text-center">
				Showing monthly totals for checked expenses (split 50/50)
			</div>
		</div>
	);
}
