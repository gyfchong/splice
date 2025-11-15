import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Calendar, ChevronLeft } from "lucide-react";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/year/$year")({
	component: YearPage,
});

function YearPage() {
	const { year } = Route.useParams();
	const yearNum = Number.parseInt(year, 10);
	const data = useQuery(api.expenses.getExpensesByYear, { year: yearNum });
	const toggleExpense = useMutation(api.expenses.toggleExpense);

	const handleToggle = async (expenseId: string) => {
		try {
			await toggleExpense({ expenseId });
		} catch (error) {
			console.error("Failed to toggle expense:", error);
		}
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr);
		return new Intl.DateTimeFormat("en-US", {
			month: "short",
			day: "numeric",
		}).format(date);
	};

	const getMonthName = (monthNum: string) => {
		const monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		];
		return monthNames[Number.parseInt(monthNum, 10) - 1];
	};

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<Link
						to="/"
						className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4"
					>
						<ChevronLeft className="w-5 h-5" />
						Back to Home
					</Link>
					<h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
						{year} Expenses
					</h1>
					<p className="text-gray-400">
						Review and split your expenses for the year
					</p>
				</div>

				{/* Loading State */}
				{data === undefined ? (
					<div className="text-gray-400">Loading expenses...</div>
				) : data.months.length === 0 ? (
					<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 text-center">
						<p className="text-gray-400">No expenses found for {year}</p>
					</div>
				) : (
					<div className="space-y-8">
						{data.months.map((month) => (
							<div
								key={month.month}
								className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6"
							>
								{/* Month Header */}
								<div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-600">
									<h2 className="text-2xl font-bold text-white flex items-center gap-2">
										<Calendar className="w-6 h-6 text-cyan-400" />
										{getMonthName(month.month)}
									</h2>
									<div className="text-right">
										<div className="text-sm text-gray-400 mb-1">Your Share</div>
										<div className="text-2xl font-bold text-cyan-400">
											{formatCurrency(month.totalShare)}
										</div>
									</div>
								</div>

								{/* Expenses List */}
								<div className="space-y-2">
									{month.expenses.map((expense) => (
										<div
											key={expense._id}
											className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
												expense.checked
													? "bg-cyan-500/10 border border-cyan-500/30"
													: "bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50"
											}`}
										>
											<input
												type="checkbox"
												checked={expense.checked}
												onChange={() => handleToggle(expense.expenseId)}
												className="w-5 h-5 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
											/>
											<div className="flex-1 min-w-0">
												<div className="text-white font-medium truncate">
													{expense.name}
												</div>
												<div className="text-sm text-gray-400">
													{formatDate(expense.date)}
												</div>
											</div>
											<div className="text-lg font-semibold text-white">
												{formatCurrency(expense.amount)}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
