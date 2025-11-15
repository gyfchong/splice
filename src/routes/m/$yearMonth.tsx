import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Calendar, ChevronLeft, User, Users } from "lucide-react";
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/m/$yearMonth")({
	component: MonthPage,
});

function MonthPage() {
	const { yearMonth } = Route.useParams();
	const [year, month] = yearMonth.split("-");
	const yearNum = Number.parseInt(year, 10);
	const data = useQuery(api.expenses.getMonthExpenses, {
		year: yearNum,
		month,
	});
	const toggleExpense = useMutation(api.expenses.toggleExpense);
	const toggleSplit = useMutation(api.expenses.toggleSplit);

	// Mark this month as visited when component mounts
	useEffect(() => {
		const visitedMonthsKey = `visitedMonths_${year}`;
		const visitedMonths = JSON.parse(
			localStorage.getItem(visitedMonthsKey) || "[]",
		);
		if (!visitedMonths.includes(month)) {
			visitedMonths.push(month);
			localStorage.setItem(visitedMonthsKey, JSON.stringify(visitedMonths));
		}
	}, [year, month]);

	const handleToggle = async (expenseId: string) => {
		try {
			await toggleExpense({ expenseId });
		} catch (error) {
			console.error("Failed to toggle expense:", error);
		}
	};

	const handleToggleSplit = async (expenseId: string) => {
		try {
			await toggleSplit({ expenseId });
		} catch (error) {
			console.error("Failed to toggle split:", error);
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
		<div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<Link
						to="/$year"
						params={{ year }}
						className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-4"
					>
						<ChevronLeft className="w-5 h-5" />
						Back to {year}
					</Link>
					<h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
						{getMonthName(month)} {year}
					</h1>
					<p className="text-gray-400">Review and split your expenses</p>
				</div>

				{/* Loading State */}
				{data === undefined ? (
					<div className="text-gray-400">Loading expenses...</div>
				) : data.expenses.length === 0 ? (
					<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 text-center">
						<p className="text-gray-400">
							No expenses found for {getMonthName(month)} {year}
						</p>
					</div>
				) : (
					<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
						{/* Month Header */}
						<div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-600">
							<h2 className="text-2xl font-bold text-white flex items-center gap-2">
								<Calendar className="w-6 h-6 text-cyan-400" />
								Expenses
							</h2>
							<div className="text-right">
								<div className="text-sm text-gray-400 mb-1">Your Share</div>
								<div className="text-2xl font-bold text-cyan-400">
									{formatCurrency(data.totalShare)}
								</div>
							</div>
						</div>

						{/* Expenses List */}
						<div className="space-y-2">
							{data.expenses.map((expense) => (
								<div
									key={expense._id}
									className={`flex items-center gap-4 p-4 rounded-lg transition-all ${
										expense.checked
											? "bg-cyan-500/10 border border-cyan-500/30"
											: "bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50"
									}`}
								>
									<input
										id={`expense.${expense.expenseId}`}
										type="checkbox"
										checked={expense.checked}
										onChange={() => handleToggle(expense.expenseId)}
										className="w-5 h-5 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
									/>
									<label
										htmlFor={`expense.${expense.expenseId}`}
										className="flex-1 min-w-0"
									>
										<div className="text-white font-medium truncate">
											{expense.name}
										</div>
										<div className="text-sm text-gray-400">
											{formatDate(expense.date)}
										</div>
									</label>
									<div className="text-lg font-semibold text-white">
										{formatCurrency(expense.amount)}
									</div>
									<div className="flex items-center gap-2">
										{(expense.split ?? true) ? (
											<Users className="w-4 h-4 text-cyan-400" />
										) : (
											<User className="w-4 h-4 text-purple-400" />
										)}
										<Switch
											checked={expense.split ?? true}
											onCheckedChange={() =>
												handleToggleSplit(expense.expenseId)
											}
											className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-purple-500"
											title={
												(expense.split ?? true)
													? "Split 50/50 - Toggle for 100%"
													: "100% - Toggle for 50/50 split"
											}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
