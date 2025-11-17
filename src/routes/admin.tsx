import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { CategorySelect } from "@/components/CategorySelect";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { api } from "../../convex/_generated/api";

// Type definitions for Convex query returns
interface AdminDashboardStats {
	expenses: {
		uncategorized: number;
		total: number;
		percentage: number;
	};
	jobQueue: {
		pending: number;
		processing: number;
		failed: number;
	};
	rateLimit: {
		available: number;
		limit: number;
		resetTime: number;
	};
	recentActivity: Array<{
		merchantName: string;
		category: string;
		date: string;
	}>;
	needsAttention: boolean;
}

interface UncategorizedExpense {
	_id: string;
	expenseId: string;
	name: string;
	amount: number;
	date: string;
}

interface UncategorizedExpensesByMerchant {
	totalUncategorized: number;
	uniqueMerchants: number;
	groups: Array<{
		merchantName: string;
		expenseCount: number;
		totalAmount: number;
		expenses: UncategorizedExpense[];
	}>;
}

export const Route = createFileRoute("/admin")({
	component: AdminPage,
});

function AdminPage() {
	const stats = useQuery(api.categorization.getAdminDashboardStats);
	const uncategorizedExpenses = useQuery(
		api.categorization.getUncategorizedExpensesByMerchant,
	);

	// Show "nothing to do" message if all categorized
	if (stats && !stats.needsAttention) {
		return <AllCaughtUp stats={stats} />;
	}

	return (
		<AdminDashboard
			stats={stats}
			uncategorizedExpenses={uncategorizedExpenses}
		/>
	);
}

function AllCaughtUp({ stats }: { stats: AdminDashboardStats }) {
	return (
		<div className="container mx-auto p-8">
			<div className="max-w-2xl mx-auto">
				<div className="bg-gradient-to-br from-green-50 to-cyan-50 border-2 border-green-200 rounded-lg p-12 text-center">
					<div className="text-8xl mb-6">✓</div>
					<h1 className="text-4xl font-bold mb-4 text-zinc-900">
						All Caught Up!
					</h1>
					<p className="text-xl text-zinc-600 mb-6">
						All {stats?.expenses.total || 0} expenses are categorized and
						merchant mappings are up to date.
					</p>
					<div className="inline-block bg-green-100 border border-green-300 rounded-full px-6 py-2">
						<span className="text-green-700 font-semibold">
							{stats?.expenses.percentage || 100}% Coverage
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}

function AdminDashboard({
	stats,
	uncategorizedExpenses,
}: {
	stats: AdminDashboardStats | undefined;
	uncategorizedExpenses: UncategorizedExpensesByMerchant | undefined;
}) {
	const deleteAllExpenses = useMutation(api.expenses.deleteAllExpenses);
	const manuallyCategorize = useAction(
		api.categorization.manuallyCategorizeExpenses,
	);
	const { toast } = useToast();
	const [isDeleting, setIsDeleting] = useState(false);
	const [expandedMerchant, setExpandedMerchant] = useState<string | null>(null);
	const [categorizingMerchant, setCategorizingMerchant] = useState<
		string | null
	>(null);

	const handleCategoryChange = async (
		merchantName: string,
		category: string,
	) => {
		setCategorizingMerchant(merchantName);
		try {
			const result = await manuallyCategorize({
				merchantName,
				category,
				userId: "anonymous",
			});

			toast({
				title: "Categorization successful!",
				description: `Updated ${result.updatedCount} expense${result.updatedCount === 1 ? "" : "s"} and removed ${result.removedFromQueue} from queue.`,
			});
		} catch (error) {
			toast({
				title: "Categorization failed",
				description: error instanceof Error ? error.message : "Unknown error",
				variant: "destructive",
			});
		} finally {
			setCategorizingMerchant(null);
		}
	};

	const handleDeleteAll = async () => {
		const confirmed = window.confirm(
			"Are you sure you want to delete ALL expenses? This action cannot be undone!",
		);

		if (!confirmed) return;

		setIsDeleting(true);
		try {
			const result = await deleteAllExpenses();
			toast({
				title: "Expenses deleted!",
				description: `${result.deletedCount} expenses have been permanently deleted.`,
			});
		} catch (error) {
			toast({
				title: "Deletion failed",
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	if (!stats) {
		return (
			<div className="container mx-auto p-8">
				<div className="text-center text-zinc-500">Loading...</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto p-8">
			<div className="mb-8">
				<h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
				<p className="text-zinc-500">
					Manage expense categorization and system optimization
				</p>
			</div>

			{/* Stats Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
				<StatCard
					title="Uncategorized Expenses"
					value={stats.expenses.uncategorized}
					subtitle={`${stats.expenses.total} total (${stats.expenses.percentage}% categorized)`}
					icon="📊"
					highlight={stats.expenses.uncategorized > 0}
				/>
				<StatCard
					title="Job Queue"
					value={stats.jobQueue.pending || 0}
					subtitle={
						stats.jobQueue.processing > 0
							? `${stats.jobQueue.processing} processing`
							: "pending jobs"
					}
					icon="⏳"
					highlight={stats.jobQueue.failed > 0}
				/>
				<StatCard
					title="Rate Limit"
					value={`${stats.rateLimit.available}/${stats.rateLimit.limit}`}
					subtitle="API calls available"
					icon="🚦"
					highlight={stats.rateLimit.available < 5}
				/>
			</div>


			{/* Danger Zone - Delete All Expenses */}
			<div className="bg-white border-2 border-red-200 rounded-lg p-8 mb-8">
				<div className="flex items-start justify-between mb-6">
					<div>
						<h2 className="text-2xl font-bold mb-2 text-red-700">
							Danger Zone
						</h2>
						<p className="text-zinc-600 max-w-2xl">
							Permanently delete all expenses from the database. This action{" "}
							<span className="font-semibold text-red-600">
								cannot be undone
							</span>
							.
						</p>
					</div>
				</div>

				{/* Delete Button */}
				<Button
					onClick={handleDeleteAll}
					disabled={isDeleting}
					className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold px-8 py-6 text-lg"
				>
					{isDeleting ? (
						<>
							<span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
							Deleting...
						</>
					) : (
						<>
							<span className="mr-2">🗑️</span>
							Delete All Expenses
						</>
					)}
				</Button>

				{/* Warning Note */}
				<div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
					<p className="text-sm text-red-900">
						<strong>⚠️ Warning:</strong> This will permanently delete all{" "}
						{stats?.expenses.total || 0} expenses from the database. You will be
						asked to confirm before deletion.
					</p>
				</div>
			</div>


			{/* Uncategorized Expenses List */}
			{uncategorizedExpenses &&
				uncategorizedExpenses.totalUncategorized > 0 && (
					<div className="bg-white border border-zinc-200 rounded-lg p-6 mb-8">
						<h3 className="text-lg font-semibold mb-4">
							Uncategorized Expenses ({uncategorizedExpenses.totalUncategorized}{" "}
							expenses from {uncategorizedExpenses.uniqueMerchants} merchants)
						</h3>
						<p className="text-sm text-zinc-500 mb-4">
							Manually select a category below to categorize these expenses.
						</p>
						<div className="space-y-2 max-h-[500px] overflow-y-auto">
							{uncategorizedExpenses.groups.map((group) => (
								<div
									key={group.merchantName}
									className="border border-zinc-200 rounded-lg overflow-hidden"
								>
									<div className="flex items-center justify-between p-4 bg-white hover:bg-zinc-50 transition-colors">
										<div className="flex-1">
											<div className="font-medium text-zinc-900">
												{group.merchantName}
											</div>
											<div className="text-sm text-zinc-500">
												{group.expenseCount} expense
												{group.expenseCount === 1 ? "" : "s"} • $
												{group.totalAmount.toFixed(2)} total
											</div>
										</div>

										<div className="flex items-center gap-3">
											<CategorySelect
												value=""
												onValueChange={(category) =>
													handleCategoryChange(group.merchantName, category)
												}
												disabled={categorizingMerchant === group.merchantName}
												className="w-48 h-9 bg-white border-zinc-300 text-sm"
											/>
											<button
												type="button"
												onClick={() =>
													setExpandedMerchant(
														expandedMerchant === group.merchantName
															? null
															: group.merchantName,
													)
												}
												className="text-zinc-400 hover:text-zinc-600 px-2"
											>
												{expandedMerchant === group.merchantName ? "▼" : "▶"}
											</button>
										</div>
									</div>

									{expandedMerchant === group.merchantName && (
										<div className="bg-zinc-50 p-4 border-t border-zinc-200">
											<div className="space-y-2">
												{group.expenses.slice(0, 10).map((expense) => (
													<div
														key={expense.expenseId}
														className="flex items-center justify-between text-sm py-2 border-b border-zinc-200 last:border-0"
													>
														<div className="flex-1">
															<div className="text-zinc-700">
																{expense.name}
															</div>
															<div className="text-xs text-zinc-500">
																{expense.date}
															</div>
														</div>
														<div className="font-semibold text-zinc-900">
															${expense.amount.toFixed(2)}
														</div>
													</div>
												))}
												{group.expenseCount > 10 && (
													<div className="text-xs text-zinc-500 text-center pt-2">
														... and {group.expenseCount - 10} more
													</div>
												)}
											</div>
										</div>
									)}
								</div>
							))}
						</div>
					</div>
				)}

			{/* Recent Activity */}
			{stats.recentActivity && stats.recentActivity.length > 0 && (
				<div className="bg-white border border-zinc-200 rounded-lg p-6">
					<h3 className="text-lg font-semibold mb-4">Recent Categorizations</h3>
					<div className="space-y-2">
						{stats.recentActivity.map((activity) => (
							<div
								key={`${activity.merchantName}-${activity.date}-${activity.category}`}
								className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0"
							>
								<div className="flex-1">
									<span className="font-medium text-zinc-900">
										{activity.merchantName}
									</span>
								</div>
								<div className="flex items-center gap-4">
									<span className="text-sm px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full">
										{activity.category}
									</span>
									<span className="text-xs text-zinc-500 w-24 text-right">
										{activity.date}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function StatCard({
	title,
	value,
	subtitle,
	icon,
	highlight,
}: {
	title: string;
	value: string | number;
	subtitle: string;
	icon: string;
	highlight?: boolean;
}) {
	return (
		<div
			className={`bg-white border-2 rounded-lg p-6 ${
				highlight
					? "border-orange-300 bg-orange-50"
					: "border-zinc-200 hover:border-zinc-300"
			} transition-colors`}
		>
			<div className="flex items-start justify-between mb-3">
				<h3 className="text-sm font-medium text-zinc-600">{title}</h3>
				<span className="text-2xl">{icon}</span>
			</div>
			<div className="text-3xl font-bold text-zinc-900 mb-1">{value}</div>
			<div className="text-xs text-zinc-500">{subtitle}</div>
		</div>
	);
}

function JobStatus({
	label,
	count,
	color,
}: {
	label: string;
	count: number;
	color: string;
}) {
	return (
		<div className="text-center">
			<div className={`text-2xl font-bold ${color}`}>{count}</div>
			<div className="text-xs text-zinc-500">{label}</div>
		</div>
	);
}
