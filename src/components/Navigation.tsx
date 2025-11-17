import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Calendar, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

export default function Navigation() {
	const navigationData = useQuery(api.expenses.getMonthsGroupedByYear);
	const routerState = useRouterState();
	const [visitedMonths, setVisitedMonths] = useState<Set<string>>(new Set());
	const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());

	// Load visited months from localStorage
	useEffect(() => {
		const visited = new Set<string>();
		if (typeof window !== "undefined") {
			// Load all visited months from all years
			const keys = Object.keys(localStorage);
			for (const key of keys) {
				if (key.startsWith("visitedMonths_")) {
					const year = key.replace("visitedMonths_", "");
					const months = JSON.parse(
						localStorage.getItem(key) || "[]",
					) as string[];
					for (const month of months) {
						visited.add(`${year}-${month}`);
					}
				}
			}
		}
		setVisitedMonths(visited);
	}, []);

	// Re-check visited months when route changes (in case user visited a month)
	// biome-ignore lint/correctness/useExhaustiveDependencies: routerState.location.pathname is intentionally the trigger
	useEffect(() => {
		const visited = new Set<string>();
		if (typeof window !== "undefined") {
			const keys = Object.keys(localStorage);
			for (const key of keys) {
				if (key.startsWith("visitedMonths_")) {
					const year = key.replace("visitedMonths_", "");
					const months = JSON.parse(
						localStorage.getItem(key) || "[]",
					) as string[];
					for (const month of months) {
						visited.add(`${year}-${month}`);
					}
				}
			}
		}
		setVisitedMonths(visited);
	}, [routerState.location.pathname]);

	// Auto-expand the year of the current route
	useEffect(() => {
		if (navigationData) {
			const currentPath = routerState.location.pathname;

			// Check if we're on a month page (/m/YYYY-MM)
			const monthMatch = currentPath.match(/\/m\/(\d{4})-(\d{2})/);
			if (monthMatch) {
				const year = Number.parseInt(monthMatch[1], 10);
				setExpandedYears((prev) => new Set(prev).add(year));
			}

			// Check if we're on a year page (/YYYY)
			const yearMatch = currentPath.match(/^\/(\d{4})$/);
			if (yearMatch) {
				const year = Number.parseInt(yearMatch[1], 10);
				setExpandedYears((prev) => new Set(prev).add(year));
			}
		}
	}, [navigationData, routerState.location.pathname]);

	const toggleYear = (year: number) => {
		setExpandedYears((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(year)) {
				newSet.delete(year);
			} else {
				newSet.add(year);
			}
			return newSet;
		});
	};

	if (!navigationData || navigationData.length === 0) {
		return null;
	}

	return (
		<nav className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto">
			<div className="p-4">
				<div className="flex items-center gap-2 mb-4 text-gray-400">
					<Calendar className="w-5 h-5" />
					<span className="font-semibold text-sm uppercase">Navigation</span>
				</div>

				<div className="space-y-2">
					{navigationData.map((yearGroup) => {
						const isExpanded = expandedYears.has(yearGroup.year);
						const hasUnseenMonths = yearGroup.months.some(
							(m) => !visitedMonths.has(m.yearMonth),
						);

						return (
							<div key={yearGroup.year}>
								{/* Year Header */}
								<button
									type="button"
									onClick={() => toggleYear(yearGroup.year)}
									className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors text-white font-semibold group"
								>
									<div className="flex items-center gap-2">
										{isExpanded ? (
											<ChevronDown className="w-4 h-4 text-gray-400" />
										) : (
											<ChevronRight className="w-4 h-4 text-gray-400" />
										)}
										<span>{yearGroup.year}</span>
										{hasUnseenMonths && !isExpanded && (
											<Circle className="w-2 h-2 fill-green-400 text-green-400" />
										)}
									</div>
									<span className="text-xs text-gray-500 group-hover:text-gray-400">
										{yearGroup.months.length} month
										{yearGroup.months.length !== 1 ? "s" : ""}
									</span>
								</button>

								{/* Months List */}
								{isExpanded && (
									<div className="ml-4 mt-1 space-y-1">
										{yearGroup.months.map((month) => {
											const isUnseen = !visitedMonths.has(month.yearMonth);
											const isActive =
												routerState.location.pathname ===
												`/m/${month.yearMonth}`;

											return (
												<Link
													key={month.yearMonth}
													to="/m/$yearMonth"
													params={{ yearMonth: month.yearMonth }}
													className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
														isActive
															? "bg-cyan-500 text-white"
															: "text-gray-300 hover:bg-slate-700 hover:text-white"
													}`}
												>
													{month.monthName}
													{isUnseen && (
														<Circle className="w-2 h-2 fill-green-400 text-green-400 ml-auto" />
													)}
												</Link>
											);
										})}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
