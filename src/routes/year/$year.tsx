import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	Calendar,
	ChevronLeft,
	Minus,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/year/$year")({
	component: YearPage,
});

function YearPage() {
	const { year } = Route.useParams();
	const yearNum = Number.parseInt(year, 10);

	// Session tracking for unseen expenses
	const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
	const [visitedMonths, setVisitedMonths] = useState<string[]>([]);

	useEffect(() => {
		// Initialize session start time from localStorage or create new
		const storedSessionTime = localStorage.getItem("sessionStartTime");
		if (storedSessionTime) {
			setSessionStartTime(Number.parseInt(storedSessionTime, 10));
		} else {
			const newSessionTime = Date.now();
			localStorage.setItem("sessionStartTime", newSessionTime.toString());
			setSessionStartTime(newSessionTime);
		}

		// Load visited months for this year
		const visitedMonthsKey = `visitedMonths_${year}`;
		const stored = JSON.parse(localStorage.getItem(visitedMonthsKey) || "[]");
		setVisitedMonths(stored);
	}, [year]);

	const data = useQuery(
		api.expenses.getYearSummary,
		sessionStartTime !== null ? { year: yearNum, sessionStartTime } : "skip",
	);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
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
						{year} Summary
					</h1>
					<p className="text-gray-400">Review your yearly expenses by month</p>
				</div>

				{/* Loading State */}
				{data === undefined ? (
					<div className="text-gray-400">Loading summary...</div>
				) : (
					<>
						{/* Year Aggregates */}
						<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
								{/* Total Shared */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">
										Total Shared ({year})
									</div>
									<div className="flex items-center justify-center gap-2">
										<div className="text-3xl font-bold text-cyan-400">
											{formatCurrency(data.totalShared)}
										</div>
										{data.changeComparedToPreviousYear && (
											<div className="flex items-center gap-1">
												{data.changeComparedToPreviousYear.icon === "up" && (
													<TrendingUp className="w-5 h-5 text-green-400" />
												)}
												{data.changeComparedToPreviousYear.icon === "down" && (
													<TrendingDown className="w-5 h-5 text-red-400" />
												)}
												{data.changeComparedToPreviousYear.icon ===
													"neutral" && (
													<Minus className="w-5 h-5 text-gray-400" />
												)}
											</div>
										)}
									</div>
								</div>

								{/* Monthly Average */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">
										Monthly Average
									</div>
									<div className="text-3xl font-bold text-white">
										{formatCurrency(data.averagePerMonth)}
									</div>
								</div>

								{/* Year-over-Year */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">
										Compared to {yearNum - 1}
									</div>
									<div
										className={`text-2xl font-semibold ${
											data.changeComparedToPreviousYear?.color === "green"
												? "text-green-400"
												: data.changeComparedToPreviousYear?.color === "red"
													? "text-red-400"
													: "text-gray-400"
										}`}
									>
										{data.changeComparedToPreviousYear?.direction === "increase"
											? "↑ Increase"
											: data.changeComparedToPreviousYear?.direction ===
													"decrease"
												? "↓ Decrease"
												: "— No Data"}
									</div>
								</div>
							</div>
						</div>

						{/* Error Message */}
						{data.error && (
							<div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-xl p-4 mb-8">
								{data.error}
							</div>
						)}

						{/* Month Cards */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{data.months.map((month) => {
								// Only show green dot if month has unseen expenses AND hasn't been visited
								const shouldShowGreenDot =
									month.showGreenDot &&
									!visitedMonths.includes(month.monthNumber);

								return (
									<Link
										key={month.monthNumber}
										to="/year/$year/month/$month"
										params={{ year, month: month.monthNumber }}
										className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 hover:border-cyan-500 rounded-xl p-6 transition-all group relative"
									>
										{/* Green Dot Indicator */}
										{shouldShowGreenDot && (
											<div className="absolute top-4 right-4">
												<div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
											</div>
										)}

										{/* Month Name */}
										<div className="flex items-center gap-2 mb-4">
											<Calendar className="w-5 h-5 text-cyan-400" />
											<h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors">
												{month.month}
											</h3>
										</div>

										{/* Amount Shared */}
										<div className="mb-2">
											<div className="text-sm text-gray-400 mb-1">
												Your Share
											</div>
											<div className="text-2xl font-bold text-cyan-400">
												{formatCurrency(month.amountShared)}
											</div>
										</div>

										{/* Number of Expenses */}
										<div className="text-sm text-gray-400">
											{month.numberOfExpenses}{" "}
											{month.numberOfExpenses === 1 ? "expense" : "expenses"}
										</div>
									</Link>
								);
							})}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
