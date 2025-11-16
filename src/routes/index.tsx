import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
	Calendar,
	ChevronRight,
	Clock,
	History,
	RefreshCw,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MonthlyExpensesChart } from "@/components/MonthlyExpensesChart";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import type { ParsedExpense } from "@/lib/pdf-parser";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const years = useQuery(api.expenses.getYears);
	const expensesFeed = useQuery(api.expenses.getExpensesFeed, {
		limit: 12, // Show last 12 months
	});
	const addExpensesWithKnownCategories = useAction(
		api.expenses.addExpensesWithKnownCategories,
	);
	const recordUpload = useMutation(api.expenses.recordUpload);
	const jobQueueStats = useQuery(api.expenses.getJobQueueStats);
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const feedTopRef = useRef<HTMLDivElement>(null);
	const [uploadStatus, setUploadStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [uploadProgress, setUploadProgress] = useState<{
		status: "idle" | "uploading" | "completed" | "failed";
		currentFile: number;
		totalFiles: number;
	}>({
		status: "idle",
		currentFile: 0,
		totalFiles: 0,
	});
	const [lastVisitedPage, setLastVisitedPage] = useState<string | null>(null);
	const [isTransitioning, setIsTransitioning] = useState(false);

	// Load last visited page from localStorage
	useEffect(() => {
		if (typeof window !== "undefined") {
			const lastPage = localStorage.getItem("lastVisitedPage");
			setLastVisitedPage(lastPage);

			// Track home page as last visited when user explicitly navigates here
			// (but don't track on initial page load if there's a previous page)
			if (!lastPage) {
				localStorage.setItem("lastVisitedPage", "/");
			}
		}
	}, []);

	const handleFiles = useCallback(
		async (files: File[]) => {
			setIsUploading(true);
			setUploadStatus(null);

			// Initialize upload progress
			setUploadProgress({
				status: "uploading",
				currentFile: 0,
				totalFiles: files.length,
			});

			try {
				// Upload files to API for parsing
				const formData = new FormData();
				for (const file of files) {
					formData.append("files", file);
				}

				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});

				const result = await response.json();

				if (result.status === "error") {
					setUploadStatus({
						type: "error",
						message: result.errorMessage || "Upload failed",
					});
					setUploadProgress((prev) => ({
						...prev,
						status: "failed",
					}));
					return;
				}

				// Process each file result
				let totalExpenses = 0;
				let totalErrors = 0;
				let totalCategorizedFromCache = 0;
				let totalUncategorized = 0;
				let fileIndex = 0;
				const uploadedMonths = new Set<string>(); // Track unique year-month combinations

				for (const fileResult of result.files) {
					fileIndex++;

					// Update progress for current file
					setUploadProgress((prev) => ({
						...prev,
						currentFile: fileIndex,
					}));

					// Record upload metadata
					await recordUpload({
						filename: fileResult.filename,
						size: fileResult.size,
						status: fileResult.status,
						errorMessage: fileResult.errorMessage,
					});

					if (fileResult.status === "success" && fileResult.expenses) {
						const expenses = fileResult.expenses as ParsedExpense[];

						// Track the months from these expenses
						for (const expense of expenses) {
							const yearMonth = `${expense.year}-${expense.month}`;
							uploadedMonths.add(yearMonth);
						}

						// Add expenses with known categories only (no AI)
						const addResult = await addExpensesWithKnownCategories({
							expenses,
							userId: "anonymous",
						});
						totalExpenses += addResult.addedCount;
						totalCategorizedFromCache += addResult.categorizedFromCache || 0;
						totalUncategorized += addResult.uncategorizedCount || 0;
					} else {
						totalErrors++;
					}
				}

				if (totalErrors > 0 && totalExpenses === 0) {
					setUploadStatus({
						type: "error",
						message: `Failed to parse ${totalErrors} file(s)`,
					});
					setUploadProgress((prev) => ({
						...prev,
						status: "failed",
					}));
				} else {
					const categorizedInfo =
						totalCategorizedFromCache > 0 || totalUncategorized > 0
							? ` (${totalCategorizedFromCache} merchants auto-categorized, ${totalUncategorized} need categorization)`
							: "";

					setUploadStatus({
						type: "success",
						message: `Successfully added ${totalExpenses} expense(s)${categorizedInfo}${
							totalErrors > 0 ? ` • ${totalErrors} file(s) had errors` : ""
						}`,
					});

					setUploadProgress((prev) => ({
						...prev,
						status: "completed",
					}));

					// Trigger transition then navigate to the oldest month
					if (uploadedMonths.size > 0) {
						const sortedMonths = Array.from(uploadedMonths).sort();
						const oldestMonth = sortedMonths[0]; // YYYY-MM format sorts correctly

						setIsTransitioning(true);

						// Wait for shrink animation to complete before navigating
						setTimeout(() => {
							navigate({
								to: "/m/$yearMonth",
								params: { yearMonth: oldestMonth },
							});
						}, 600); // Match CSS transition duration
					}

					// Check for uncategorized expenses and show toast notification
					if (totalUncategorized > 0) {
						setTimeout(() => {
							toast({
								title: `${totalUncategorized} expense${totalUncategorized === 1 ? "" : "s"} need${totalUncategorized === 1 ? "s" : ""} categorization`,
								description: "Some merchants are not yet recognized.",
								duration: 10000, // Show for 10 seconds
								action: (
									<ToastAction
										altText="Categorize Now"
										onClick={() => navigate({ to: "/admin" })}
									>
										Categorize Now
									</ToastAction>
								),
							});
						}, 2000);
					}
				}
			} catch (error) {
				setUploadStatus({
					type: "error",
					message: error instanceof Error ? error.message : "Upload failed",
				});
				setUploadProgress((prev) => ({
					...prev,
					status: "failed",
				}));
			} finally {
				setIsUploading(false);
			}
		},
		[addExpensesWithKnownCategories, recordUpload, toast, navigate],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		async (e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);

			const files = Array.from(e.dataTransfer.files).filter(
				(file) =>
					file.type === "application/pdf" ||
					file.type === "text/csv" ||
					file.type === "application/csv" ||
					file.name.endsWith(".csv"),
			);

			if (files.length === 0) {
				setUploadStatus({
					type: "error",
					message: "Please upload only PDF or CSV files",
				});
				return;
			}

			await handleFiles(files);
		},
		[handleFiles],
	);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		// Trigger file input on Enter or Space key
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			document.getElementById("file-upload")?.click();
		}
	}, []);

	const handleFileInput = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files || []).filter(
				(file) =>
					file.type === "application/pdf" ||
					file.type === "text/csv" ||
					file.type === "application/csv" ||
					file.name.endsWith(".csv"),
			);

			if (files.length === 0) {
				setUploadStatus({
					type: "error",
					message: "Please upload only PDF or CSV files",
				});
				return;
			}

			await handleFiles(files);
		},
		[handleFiles],
	);

	// Check if user has expenses
	const hasExpenses = expensesFeed !== undefined && expensesFeed.length > 0;

	return (
		<div className="min-h-screen bg-linear-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			{/* Upload Progress Banner - ARIA Live Region */}
			{uploadProgress.status === "uploading" && (
				<output
					className="fixed top-0 left-0 right-0 z-50 shadow-lg transition-all bg-blue-500/90 backdrop-blur-sm"
					aria-live="polite"
					aria-atomic="true"
				>
					<div className="max-w-4xl mx-auto px-6 py-4">
						<div className="flex items-center gap-3">
							<Upload className="w-5 h-5 animate-pulse text-white" />
							<div>
								<span className="text-white font-semibold">
									Uploading files...
								</span>
								<p className="text-sm text-white/90">
									Processing file {uploadProgress.currentFile} of{" "}
									{uploadProgress.totalFiles}
								</p>
							</div>
						</div>
					</div>
				</output>
			)}

			<div
				className={`max-w-4xl mx-auto ${uploadProgress.status === "uploading" ? "mt-24" : ""} ${isTransitioning ? "upload-shrinking" : ""}`}
			>
				<h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
					Luman
				</h1>
				<p className="text-gray-400 text-center mb-6">
					{hasExpenses
						? "Your personal expense tracker"
						: "Upload your expenses to get started"}
				</p>

				{/* Last Visited Page - Show if exists and not on home page initially */}
				{lastVisitedPage && lastVisitedPage !== "/" && (
					<div className="mb-6 flex justify-center">
						<Link
							to={lastVisitedPage}
							className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-400 rounded-lg transition-colors font-medium"
						>
							<History className="w-4 h-4" />
							Return to last visited page
						</Link>
					</div>
				)}

				{/* Upload Area - Compact when expenses exist, prominent when empty */}
				<div className={`${hasExpenses ? "mb-8" : "mb-12"}`}>
					{hasExpenses ? (
						// Compact upload button when expenses exist
						<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
							<div className="flex items-center justify-between gap-4">
								<div className="flex items-center gap-3">
									<Upload className="w-5 h-5 text-cyan-400" />
									<div>
										<h3 className="text-lg font-semibold text-white">
											Add More Expenses
										</h3>
										<p className="text-sm text-gray-400">
											Upload PDF or CSV files
										</p>
									</div>
								</div>
								<label
									htmlFor="file-upload"
									className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white font-semibold rounded-lg transition-colors cursor-pointer"
									aria-disabled={isUploading}
								>
									{isUploading ? "Uploading..." : "Upload Files"}
								</label>
								<input
									id="file-upload"
									type="file"
									multiple
									accept=".pdf,.csv"
									className="hidden"
									onChange={handleFileInput}
									disabled={isUploading}
								/>
							</div>
						</div>
					) : (
						// Prominent upload area when no expenses exist
						<button
							type="button"
							tabIndex={isUploading ? -1 : 0}
							aria-label="File upload area. Press Enter or Space to select files, or drag and drop files here."
							aria-describedby="upload-instructions"
							aria-busy={isUploading}
							className={`block w-full border-2 border-dashed rounded-xl p-12 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
								isDragging
									? "border-cyan-500 bg-cyan-500/10"
									: "border-slate-600 bg-slate-800/50"
							}`}
							onDragOver={handleDragOver}
							onDragLeave={handleDragLeave}
							onDrop={handleDrop}
							onKeyDown={handleKeyDown}
						>
							<div className="flex flex-col items-center justify-center text-center">
								<Upload
									className={`w-16 h-16 mb-4 ${
										isDragging ? "text-cyan-400" : "text-gray-400"
									}`}
									aria-hidden="true"
								/>
								<h3 className="text-xl font-semibold text-white mb-2">
									{isDragging ? "Drop files here" : "Upload Expense Files"}
								</h3>
								<p id="upload-instructions" className="text-gray-400 mb-2">
									Drag and drop PDF or CSV files or click to browse
								</p>
								<p className="text-sm text-gray-500 mb-4">
									Accepted formats: PDF, CSV. Max file size: 10MB per file.
								</p>
								<label
									htmlFor="file-upload-empty"
									className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white font-semibold rounded-lg transition-colors cursor-pointer inline-block"
									aria-disabled={isUploading}
								>
									{isUploading ? "Uploading..." : "Choose Files"}
								</label>
								<input
									id="file-upload-empty"
									type="file"
									multiple
									accept=".pdf,.csv"
									aria-describedby="upload-instructions"
									className="hidden"
									onChange={handleFileInput}
									disabled={isUploading}
								/>
							</div>
						</button>
					)}
				</div>

				{/* Upload Status - ARIA Live Region */}
				{uploadStatus && (
					<output
						aria-live="polite"
						aria-atomic="true"
						className={`block w-full mb-8 p-4 rounded-lg ${
							uploadStatus.type === "success"
								? "bg-green-500/10 border border-green-500/50 text-green-400"
								: "bg-red-500/10 border border-red-500/50 text-red-400"
						}`}
					>
						{uploadStatus.message}
					</output>
				)}

				{/* Expense Feed/Timeline */}
				{hasExpenses ? (
					<div ref={feedTopRef}>
						{/* Feed Header */}
						<div className="flex items-center justify-between mb-6">
							<h2 className="text-2xl font-bold text-white flex items-center gap-2">
								<Clock className="w-6 h-6" />
								Expense Feed
							</h2>
							{years && years.length > 0 && (
								<Link
									to="/$year"
									params={{ year: years[0].toString() }}
									className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm font-medium transition-colors"
								>
									View All Years
									<ChevronRight className="w-4 h-4" />
								</Link>
							)}
						</div>

						{/* Expense Feed - Grouped by Month */}
						<div className="space-y-8">
							{expensesFeed === undefined ? (
								<p className="text-gray-400">Loading...</p>
							) : expensesFeed.length === 0 ? (
								<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 text-center">
									<p className="text-gray-400">
										No expenses yet. Upload a file to get started.
									</p>
								</div>
							) : (
								expensesFeed.map((monthGroup) => {
									return (
										<div key={monthGroup.yearMonth} className="space-y-4">
											{/* Month Header */}
											<div className="flex items-center justify-between">
												<h3 className="text-xl font-bold text-white">
													{monthGroup.monthName}, {monthGroup.year}
												</h3>
												<Link
													to="/m/$yearMonth"
													params={{ yearMonth: monthGroup.yearMonth }}
													className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm font-medium transition-colors"
												>
													View Month
													<ChevronRight className="w-4 h-4" />
												</Link>
											</div>

											{/* Month Summary Stats */}
											<div className="grid grid-cols-3 gap-3 mb-4">
												<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-3">
													<div className="text-xs text-gray-400 mb-1">
														Total
													</div>
													<div className="text-lg font-bold text-white">
														${monthGroup.totals.all.toFixed(2)}
													</div>
													<div className="text-xs text-gray-500">
														{monthGroup.expenseCount} expense
														{monthGroup.expenseCount !== 1 ? "s" : ""}
													</div>
												</div>
												<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-3">
													<div className="text-xs text-gray-400 mb-1">
														Shared (50%)
													</div>
													<div className="text-lg font-bold text-green-400">
														${monthGroup.totals.shared.toFixed(2)}
													</div>
													<div className="text-xs text-gray-500">
														{monthGroup.counts.shared} expense
														{monthGroup.counts.shared !== 1 ? "s" : ""}
													</div>
												</div>
												<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-lg p-3">
													<div className="text-xs text-gray-400 mb-1">
														Individual (100%)
													</div>
													<div className="text-lg font-bold text-blue-400">
														${monthGroup.totals.mine.toFixed(2)}
													</div>
													<div className="text-xs text-gray-500">
														{monthGroup.counts.mine} expense
														{monthGroup.counts.mine !== 1 ? "s" : ""}
													</div>
												</div>
											</div>

											{/* Expense List */}
											<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl divide-y divide-slate-700">
												{monthGroup.expenses.map((expense) => {
													const expenseDate = new Date(expense.date);
													const isSplit = expense.split ?? false;
													const yourShare = isSplit
														? expense.amount / 2
														: expense.amount;

													return (
														<div
															key={expense._id}
															className="p-4 hover:bg-slate-700/30 transition-colors"
														>
															<div className="flex items-start justify-between gap-4">
																<div className="flex-1 min-w-0">
																	<div className="flex items-center gap-2 mb-1">
																		<span className="text-white font-medium truncate">
																			{expense.name}
																		</span>
																		{expense.category && (
																			<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
																				{expense.category}
																			</span>
																		)}
																	</div>
																	<div className="flex items-center gap-3 text-xs text-gray-400">
																		<span>
																			{expenseDate.toLocaleDateString("en-US", {
																				month: "short",
																				day: "numeric",
																				year: "numeric",
																			})}
																		</span>
																		<span className="flex items-center gap-1">
																			{isSplit ? (
																				<span className="text-green-400">
																					Split (50%)
																				</span>
																			) : (
																				<span className="text-blue-400">
																					Individual (100%)
																				</span>
																			)}
																		</span>
																	</div>
																</div>
																<div className="text-right flex-shrink-0">
																	<div className="text-lg font-bold text-white">
																		${yourShare.toFixed(2)}
																	</div>
																	{isSplit && (
																		<div className="text-xs text-gray-500">
																			of ${expense.amount.toFixed(2)}
																		</div>
																	)}
																</div>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									);
								})
							)}
						</div>

						{/* Monthly Chart Section */}
						<div className="mt-12">
							<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
								<Calendar className="w-6 h-6" />
								Spending Trends
							</h2>
							<MonthlyExpensesChart />
						</div>
					</div>
				) : (
					// Empty state - show welcome message and chart if any data exists
					<div>
						{years && years.length > 0 && (
							<div className="mb-8">
								<MonthlyExpensesChart />
							</div>
						)}
					</div>
				)}

				{/* Phase 3: Job Queue Status */}
				{jobQueueStats &&
					(jobQueueStats.pending > 0 ||
						jobQueueStats.processing > 0 ||
						jobQueueStats.failed > 0) && (
						<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 mt-8">
							<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
								<RefreshCw
									className={`w-6 h-6 ${jobQueueStats.processing > 0 ? "animate-spin text-cyan-400" : "text-gray-400"}`}
								/>
								Background Categorization Queue
							</h2>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div className="bg-slate-700/50 rounded-lg p-4">
									<div className="text-gray-400 text-sm mb-1">Pending</div>
									<div className="text-2xl font-bold text-yellow-400">
										{jobQueueStats.pending}
									</div>
								</div>
								<div className="bg-slate-700/50 rounded-lg p-4">
									<div className="text-gray-400 text-sm mb-1">Processing</div>
									<div className="text-2xl font-bold text-cyan-400">
										{jobQueueStats.processing}
									</div>
								</div>
								<div className="bg-slate-700/50 rounded-lg p-4">
									<div className="text-gray-400 text-sm mb-1">Completed</div>
									<div className="text-2xl font-bold text-green-400">
										{jobQueueStats.completed}
									</div>
								</div>
								<div className="bg-slate-700/50 rounded-lg p-4">
									<div className="text-gray-400 text-sm mb-1">Failed</div>
									<div className="text-2xl font-bold text-red-400">
										{jobQueueStats.failed}
									</div>
								</div>
							</div>
							{jobQueueStats.retryable > 0 && (
								<div className="mt-4 text-sm text-gray-400">
									{jobQueueStats.retryable} failed job(s) ready for retry
								</div>
							)}
						</div>
					)}
			</div>
		</div>
	);
}
