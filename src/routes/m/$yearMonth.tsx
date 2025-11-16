import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronLeft, Tag, User, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CategorySelect } from "@/components/CategorySelect";
import { ExpenseTabs } from "@/components/ExpenseTabs";
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
	const toggleSplit = useMutation(api.expenses.toggleSplit);
	const updateCategoryWithMapping = useAction(
		api.categorization.updateExpenseCategoryWithMapping,
	);

	// Tab state
	const [activeTab, setActiveTab] = useState<"all" | "mine" | "shared">("all");

	// Track which expense is being updated
	const [updatingExpenseId, setUpdatingExpenseId] = useState<string | null>(
		null,
	);

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

	const handleToggleSplit = async (expenseId: string) => {
		try {
			await toggleSplit({ expenseId });
		} catch (error) {
			console.error("Failed to toggle split:", error);
		}
	};

	const handleCategoryChange = async (
		expenseId: string,
		merchantName: string,
		newCategory: string,
	) => {
		setUpdatingExpenseId(expenseId);
		try {
			await updateCategoryWithMapping({
				expenseId,
				merchantName,
				category: newCategory,
				updateAllFromMerchant: true, // Apply to all future expenses from this merchant
			});
		} catch (error) {
			console.error("Failed to update category:", error);
		} finally {
			setUpdatingExpenseId(null);
		}
	};

	// Filter expenses based on active tab
	const filteredExpenses = useMemo(() => {
		if (!data) return [];

		switch (activeTab) {
			case "mine":
				return data.expenses.filter((e) => !(e.split ?? true));
			case "shared":
				return data.expenses.filter((e) => e.split ?? true);
			default:
				return data.expenses;
		}
	}, [data, activeTab]);

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
						{/* Expense Tabs */}
						<ExpenseTabs
							totals={data.totals}
							counts={data.counts}
							activeTab={activeTab}
							onTabChange={setActiveTab}
						/>

						{/* Expenses List */}
						{filteredExpenses.length === 0 ? (
							<div className="text-center py-8 text-gray-400">
								No {activeTab === "mine" ? "individual" : "shared"} expenses
								this month
							</div>
						) : (
							<div className="space-y-3">
								{filteredExpenses.map((expense) => {
									const isSplit = expense.split ?? true;
									const yourShare = isSplit
										? expense.amount / 2
										: expense.amount;
									const sharePercentage = isSplit ? 50 : 100;

									return (
										<div
											key={expense._id}
											className="p-4 rounded-lg transition-all bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50"
										>
											{/* Main row: name, amount, your share badge, split toggle */}
											<div className="flex items-center gap-4 mb-3">
												<div className="flex-1 min-w-0">
													<div className="text-white font-medium truncate">
														{expense.name}
													</div>
													<div className="text-sm text-gray-400">
														{formatDate(expense.date)}
													</div>
												</div>
												<div className="flex-shrink-0 text-right">
													<div className="text-lg font-semibold text-white">
														{formatCurrency(expense.amount)}
													</div>
													<div
														className={`text-xs font-medium ${isSplit ? "text-cyan-400" : "text-purple-400"}`}
													>
														Your share: {formatCurrency(yourShare)} (
														{sharePercentage}%)
													</div>
												</div>
												<div className="flex items-center gap-2 flex-shrink-0">
													{isSplit ? (
														<Users className="w-4 h-4 text-cyan-400" />
													) : (
														<User className="w-4 h-4 text-purple-400" />
													)}
													<Switch
														checked={isSplit}
														onCheckedChange={() =>
															handleToggleSplit(expense.expenseId)
														}
														className="data-[state=checked]:bg-cyan-500 data-[state=unchecked]:bg-purple-500"
														title={
															isSplit
																? "Split 50/50 - Toggle for 100%"
																: "100% - Toggle for 50/50 split"
														}
													/>
												</div>
											</div>

											{/* Category row */}
											<div className="flex items-center gap-2">
												<Tag className="w-4 h-4 text-gray-400 flex-shrink-0" />
												<CategorySelect
													value={expense.category || "Other"}
													onValueChange={(newCategory) =>
														handleCategoryChange(
															expense.expenseId,
															expense.merchantName || expense.name,
															newCategory,
														)
													}
													disabled={updatingExpenseId === expense.expenseId}
												/>
												{updatingExpenseId === expense.expenseId && (
													<span className="text-xs text-gray-400">
														Updating...
													</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
