import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/admin")({
	component: AdminPage,
});

function AdminPage() {
	const stats = useQuery(api.categorization.getAdminDashboardStats);

	// Show "nothing to do" message if all categorized
	if (stats && !stats.needsAttention) {
		return <AllCaughtUp stats={stats} />;
	}

	return <AdminDashboard stats={stats} />;
}

function AllCaughtUp({ stats }: { stats: any }) {
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

function AdminDashboard({ stats }: { stats: any }) {
	const runWorkflow = useAction(
		api.categorization.runFullCategorizationWorkflow,
	);
	const deleteAllExpenses = useMutation(api.expenses.deleteAllExpenses);
	const { toast } = useToast();
	const [isProcessing, setIsProcessing] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleRunWorkflow = async () => {
		setIsProcessing(true);
		try {
			const result = await runWorkflow();
			toast({
				title: "Categorization complete!",
				description: `${result.phase1.newlyCategorized} expenses categorized, ${result.phase2.created} merchants mapped.`,
			});
		} catch (error: any) {
			toast({
				title: "Categorization failed",
				description: error.message,
			});
		} finally {
			setIsProcessing(false);
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
		} catch (error: any) {
			toast({
				title: "Deletion failed",
				description: error.message,
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

			{/* Main Action Card */}
			<div className="bg-white border-2 border-zinc-200 rounded-lg p-8 mb-8">
				<div className="flex items-start justify-between mb-6">
					<div>
						<h2 className="text-2xl font-bold mb-2">
							Auto-Categorize & Optimize
						</h2>
						<p className="text-zinc-600 max-w-2xl">
							Automatically categorize{" "}
							<span className="font-semibold text-cyan-600">
								{stats.expenses.uncategorized}
							</span>{" "}
							uncategorized expenses using AI and rebuild merchant mappings to
							improve future categorization accuracy.
						</p>
					</div>
				</div>

				{/* Action Button */}
				<Button
					onClick={handleRunWorkflow}
					disabled={isProcessing || stats.expenses.uncategorized === 0}
					className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold px-8 py-6 text-lg"
				>
					{isProcessing ? (
						<>
							<span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
							Processing...
						</>
					) : (
						<>
							<span className="mr-2">🚀</span>
							Run Categorization Workflow
						</>
					)}
				</Button>

				{/* Info Note */}
				<div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
					<p className="text-sm text-blue-900">
						<strong>ℹ️ What happens:</strong> The system will categorize
						uncategorized expenses using AI (respecting rate limits), then
						rebuild global merchant mappings from all categorized data to
						improve future auto-categorization.
					</p>
				</div>
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

			{/* Job Queue Status */}
			{(stats.jobQueue.pending > 0 ||
				stats.jobQueue.processing > 0 ||
				stats.jobQueue.failed > 0) && (
				<div className="bg-white border border-zinc-200 rounded-lg p-6 mb-8">
					<h3 className="text-lg font-semibold mb-4">Background Job Queue</h3>
					<div className="grid grid-cols-3 gap-4">
						<JobStatus
							label="Pending"
							count={stats.jobQueue.pending || 0}
							color="text-yellow-600"
						/>
						<JobStatus
							label="Processing"
							count={stats.jobQueue.processing || 0}
							color="text-blue-600"
						/>
						<JobStatus
							label="Failed"
							count={stats.jobQueue.failed || 0}
							color="text-red-600"
						/>
					</div>
					<p className="text-xs text-zinc-500 mt-4">
						Background jobs process automatically every 5 seconds (cron job)
					</p>
				</div>
			)}

			{/* Recent Activity */}
			{stats.recentActivity && stats.recentActivity.length > 0 && (
				<div className="bg-white border border-zinc-200 rounded-lg p-6">
					<h3 className="text-lg font-semibold mb-4">Recent Categorizations</h3>
					<div className="space-y-2">
						{stats.recentActivity.map((activity: any, index: number) => (
							<div
								key={index}
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
