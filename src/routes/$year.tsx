import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import {
	Calendar,
	ChevronLeft,
	Minus,
	RefreshCw,
	TrendingDown,
	TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/$year")({
	component: YearPage,
});

function YearPage() {
	const { year } = Route.useParams();
	const yearNum = Number.parseInt(year, 10);

	// Session tracking for unseen expenses
	const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
	const [visitedMonths, setVisitedMonths] = useState<string[]>([]);

	// Categorization
	const categorizeExpenses = useAction(
		api.categorization.categorizeExistingExpenses,
	);
	const [isCategorizing, setIsCategorizing] = useState(false);
	const [categorizeStatus, setCategorizeStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

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

		// Track this as the last visited page
		localStorage.setItem("lastVisitedPage", `/${year}`);
	}, [year]);

	const data = useQuery(
		api.expenses.getYearSummary,
		sessionStartTime !== null ? { year: yearNum, sessionStartTime } : "skip",
	);

	const handleCategorizeExpenses = useCallback(async () => {
		setIsCategorizing(true);
		setCategorizeStatus(null);

		try {
			const result = await categorizeExpenses({ userId: "anonymous" });

			// Check if we hit rate limiting
			if (result.rateLimitResetTime) {
				const resetDate = new Date(result.rateLimitResetTime);
				const now = new Date();
				const minutesUntilReset = Math.ceil(
					(resetDate.getTime() - now.getTime()) / 60000,
				);
				const resetTimeStr = resetDate.toLocaleTimeString();

				setCategorizeStatus({
					type: "error",
					message: `Rate limit reached. Categorized ${result.newlyCategorized} expenses before limit. You can resume at ${resetTimeStr} (in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? "s" : ""}). Free tier limit: 16 requests/minute.`,
				});
			} else {
				setCategorizeStatus({
					type: "success",
					message: `Categorization complete: ${result.totalExpenses} total expenses, ${result.alreadyCategorized} already categorized, ${result.newlyCategorized} newly categorized${result.errors > 0 ? `, ${result.errors} errors` : ""}`,
				});
			}
		} catch (error) {
			setCategorizeStatus({
				type: "error",
				message:
					error instanceof Error ? error.message : "Categorization failed",
			});
		} finally {
			setIsCategorizing(false);
		}
	}, [categorizeExpenses]);

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	return (
		<div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
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
							<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
								{/* Total Spending */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">
										Total Spending ({year})
									</div>
									<div className="flex items-center justify-center gap-2">
										<div className="text-3xl font-bold text-cyan-400">
											{formatCurrency(data.totals.all)}
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
									<div className="text-xs text-gray-400 mt-1">
										Shared + Mine
									</div>
								</div>

								{/* Shared Breakdown */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">Shared (50%)</div>
									<div className="text-2xl font-bold text-white">
										{formatCurrency(data.totals.shared)}
									</div>
									<div className="text-xs text-gray-400 mt-1">Your half</div>
								</div>

								{/* Mine Breakdown */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">Mine (100%)</div>
									<div className="text-2xl font-bold text-white">
										{formatCurrency(data.totals.mine)}
									</div>
									<div className="text-xs text-gray-400 mt-1">Individual</div>
								</div>

								{/* Monthly Average */}
								<div className="text-center">
									<div className="text-sm text-gray-400 mb-2">
										Monthly Average
									</div>
									<div className="text-2xl font-bold text-white">
										{formatCurrency(data.averagePerMonth)}
									</div>
									<div className="text-xs text-gray-400 mt-1">
										{data.changeComparedToPreviousYear?.direction === "increase"
											? "↑ More than last year"
											: data.changeComparedToPreviousYear?.direction ===
													"decrease"
												? "↓ Less than last year"
												: "First year"}
									</div>
								</div>
							</div>
						</div>

						{/* Categorize Expenses Section */}
						<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8">
							<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
								<div>
									<h3 className="text-lg font-semibold text-white mb-2">
										Categorize Uncategorized Expenses
									</h3>
									<p className="text-gray-400 text-sm">
										Use AI to automatically categorize expenses that don't have
										categories yet.
									</p>
									<p className="text-sm text-yellow-400 mt-1">
										⚠️ Rate Limit: 16 requests/minute (free tier)
									</p>
								</div>
								<button
									type="button"
									onClick={handleCategorizeExpenses}
									disabled={isCategorizing}
									className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap"
								>
									<RefreshCw
										className={`w-5 h-5 ${isCategorizing ? "animate-spin" : ""}`}
									/>
									{isCategorizing ? "Categorizing..." : "Categorize Expenses"}
								</button>
							</div>

							{categorizeStatus && (
								<div
									className={`mt-4 p-4 rounded-lg ${
										categorizeStatus.type === "success"
											? "bg-green-500/10 border border-green-500/50 text-green-400"
											: "bg-red-500/10 border border-red-500/50 text-red-400"
									}`}
								>
									{categorizeStatus.message}
								</div>
							)}
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
										to="/m/$yearMonth"
										params={{ yearMonth: `${year}-${month.monthNumber}` }}
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

										{/* Total Spending */}
										<div className="mb-3">
											<div className="text-sm text-gray-400 mb-1">
												You Spent
											</div>
											<div className="text-2xl font-bold text-cyan-400">
												{formatCurrency(month.totals.all)}
											</div>
										</div>

										{/* Breakdown */}
										<div className="flex gap-3 text-sm mb-2">
											<div>
												<span className="text-gray-400">Shared:</span>{" "}
												<span className="text-white font-medium">
													{formatCurrency(month.totals.shared)}
												</span>
											</div>
											<div>
												<span className="text-gray-400">Mine:</span>{" "}
												<span className="text-white font-medium">
													{formatCurrency(month.totals.mine)}
												</span>
											</div>
										</div>

										{/* Number of Expenses */}
										<div className="text-sm text-gray-400">
											{month.counts.all} expenses ({month.counts.shared} shared,{" "}
											{month.counts.mine} individual)
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
