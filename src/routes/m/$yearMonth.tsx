import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { ChevronLeft, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CategorySelect } from "@/components/CategorySelect";
import { ExpenseListSkeleton } from "@/components/ExpenseListSkeleton";
import { ExpenseTabs } from "@/components/ExpenseTabs";
import { FloatingProgressBar } from "@/components/FloatingProgressBar";
import { Button } from "@/components/ui/button";
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
	const bulkDeleteExpenses = useMutation(api.expenses.bulkDeleteExpenses);
	const bulkSetSplit = useMutation(api.expenses.bulkSetSplit);
	const bulkSetIndividual = useMutation(api.expenses.bulkSetIndividual);
	const updateCategoryWithMapping = useAction(
		api.categorization.updateExpenseCategoryWithMapping,
	);

	// Tab state
	const [activeTab, setActiveTab] = useState<"all" | "mine" | "shared">("all");

	// Track which expense is being updated
	const [updatingExpenseId, setUpdatingExpenseId] = useState<string | null>(
		null,
	);

	// Selection state
	const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(
		new Set(),
	);
	const [isProcessingBulk, setIsProcessingBulk] = useState(false);

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

		// Track this as the last visited page
		localStorage.setItem("lastVisitedPage", `/m/${yearMonth}`);
	}, [year, month, yearMonth]);

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
				return data.expenses.filter((e) => !(e.split ?? false));
			case "shared":
				return data.expenses.filter((e) => e.split ?? false);
			default:
				return data.expenses;
		}
	}, [data, activeTab]);

	// Clear selection when tab changes
	// biome-ignore lint/correctness/useExhaustiveDependencies: activeTab is intentionally the trigger
	useEffect(() => {
		setSelectedExpenses(new Set());
	}, [activeTab]);

	// Selection handlers
	const handleSelectAll = () => {
		if (selectedExpenses.size === filteredExpenses.length) {
			setSelectedExpenses(new Set());
		} else {
			setSelectedExpenses(new Set(filteredExpenses.map((e) => e.expenseId)));
		}
	};

	const handleSelectExpense = (expenseId: string) => {
		const newSelected = new Set(selectedExpenses);
		if (newSelected.has(expenseId)) {
			newSelected.delete(expenseId);
		} else {
			newSelected.add(expenseId);
		}
		setSelectedExpenses(newSelected);
	};

	// Bulk action handlers
	const handleBulkDelete = async () => {
		if (selectedExpenses.size === 0) return;

		const confirmed = window.confirm(
			`Are you sure you want to delete ${selectedExpenses.size} expense${selectedExpenses.size > 1 ? "s" : ""}? This action cannot be undone.`,
		);

		if (!confirmed) return;

		setIsProcessingBulk(true);
		try {
			await bulkDeleteExpenses({ expenseIds: Array.from(selectedExpenses) });
			setSelectedExpenses(new Set());
		} catch (error) {
			console.error("Failed to delete expenses:", error);
		} finally {
			setIsProcessingBulk(false);
		}
	};

	const handleBulkSetSplit = async () => {
		if (selectedExpenses.size === 0) return;

		setIsProcessingBulk(true);
		try {
			await bulkSetSplit({ expenseIds: Array.from(selectedExpenses) });
			setSelectedExpenses(new Set());
		} catch (error) {
			console.error("Failed to set expenses as split:", error);
		} finally {
			setIsProcessingBulk(false);
		}
	};

	const handleBulkSetIndividual = async () => {
		if (selectedExpenses.size === 0) return;

		setIsProcessingBulk(true);
		try {
			await bulkSetIndividual({ expenseIds: Array.from(selectedExpenses) });
			setSelectedExpenses(new Set());
		} catch (error) {
			console.error("Failed to set expenses as individual:", error);
		} finally {
			setIsProcessingBulk(false);
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
			<FloatingProgressBar />
			<div className="max-w-6xl mx-auto page-fade-in">
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
					<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
						<div className="mb-4">
							<div className="h-8 bg-slate-600/30 rounded w-48 animate-pulse" />
						</div>
						<ExpenseListSkeleton count={8} />
					</div>
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

						{/* Bulk Actions Bar */}
						{selectedExpenses.size > 0 && (
							<div className="mb-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
								<div className="flex items-center justify-between">
									<div className="text-cyan-400 font-medium">
										{selectedExpenses.size} expense
										{selectedExpenses.size > 1 ? "s" : ""} selected
									</div>
									<div className="flex gap-2">
										<Button
											onClick={handleBulkSetSplit}
											disabled={isProcessingBulk}
											className="bg-cyan-600 hover:bg-cyan-700 text-white"
											size="sm"
										>
											Split All (50%)
										</Button>
										<Button
											onClick={handleBulkSetIndividual}
											disabled={isProcessingBulk}
											className="bg-purple-600 hover:bg-purple-700 text-white"
											size="sm"
										>
											Individual All (100%)
										</Button>
										<Button
											onClick={handleBulkDelete}
											disabled={isProcessingBulk}
											className="bg-red-600 hover:bg-red-700 text-white"
											size="sm"
										>
											<Trash2 className="w-4 h-4 mr-2" />
											Delete All
										</Button>
									</div>
								</div>
							</div>
						)}

						{/* Expenses List */}
						{filteredExpenses.length === 0 ? (
							<div className="text-center py-8 text-gray-400">
								No {activeTab === "mine" ? "individual" : "shared"} expenses
								this month
							</div>
						) : (
							<div className="space-y-3">
								{/* Select All Header */}
								<div className="flex items-center gap-3 px-4 py-2 bg-slate-700/20 rounded-lg border border-slate-600/30">
									<input
										type="checkbox"
										checked={
											filteredExpenses.length > 0 &&
											selectedExpenses.size === filteredExpenses.length
										}
										onChange={handleSelectAll}
										className="w-5 h-5 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 bg-slate-700 cursor-pointer"
									/>
									<span className="text-sm text-gray-400 font-medium">
										Select All ({filteredExpenses.length})
									</span>
								</div>

								{/* Expense Items */}
								{filteredExpenses.map((expense) => {
									const isSplit = expense.split ?? false;
									const yourShare = isSplit
										? expense.amount / 2
										: expense.amount;

									return (
										<div
											key={expense._id}
											className={`p-4 rounded-lg transition-all border ${
												selectedExpenses.has(expense.expenseId)
													? "bg-cyan-500/10 border-cyan-500/50"
													: "bg-slate-700/30 border-slate-600/30 hover:bg-slate-700/50"
											}`}
										>
											{/* Main row: checkbox, name, amount, split toggle */}
											<div className="flex items-center gap-4 mb-3">
												{/* Checkbox */}
												<input
													type="checkbox"
													checked={selectedExpenses.has(expense.expenseId)}
													onChange={() =>
														handleSelectExpense(expense.expenseId)
													}
													className="w-5 h-5 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 bg-slate-700 cursor-pointer shrink-0"
												/>

												<div className="flex-1 min-w-0">
													<div className="text-white font-medium truncate">
														{expense.name}
													</div>
													<div className="text-sm text-gray-400">
														{formatDate(expense.date)}
													</div>
												</div>
												<div className="shrink-0 text-right">
													<div className="text-lg font-semibold text-white">
														{formatCurrency(expense.amount)}
													</div>
													<div className="text-xs text-gray-400">
														{formatCurrency(yourShare)}
													</div>
												</div>
												<div className="flex items-center gap-2 shrink-0">
													<span className="text-xs text-gray-400">Split</span>
													<Switch
														checked={isSplit}
														onCheckedChange={() =>
															handleToggleSplit(expense.expenseId)
														}
														className="data-[state=checked]:bg-slate-500 data-[state=unchecked]:bg-slate-500"
														title={
															isSplit
																? "Split 50/50 - Toggle for 100%"
																: "100% - Toggle for 50/50 split"
														}
													/>
												</div>
											</div>

											{/* Category row (indented to align with content) */}
											<div className="flex items-center gap-2 ml-9 mb-2">
												<Tag className="w-4 h-4 text-gray-400 shrink-0" />
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

											{/* Shared tag at bottom */}
											{isSplit && (
												<div className="ml-9">
													<span className="inline-block px-2 py-0.5 text-xs font-medium bg-slate-600 text-slate-300 rounded">
														Shared
													</span>
												</div>
											)}
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
