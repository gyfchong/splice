import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Calendar, RefreshCw, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { MonthlyExpensesChart } from "@/components/MonthlyExpensesChart";
import type { ParsedExpense } from "@/lib/pdf-parser";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
	const years = useQuery(api.expenses.getYears);
	const addExpensesWithCategories = useAction(
		api.expenses.addExpensesWithCategories,
	);
	const addExpensesWithBackgroundCategorization = useAction(
		api.expenses.addExpensesWithBackgroundCategorization,
	);
	const recordUpload = useMutation(api.expenses.recordUpload);
	const populateMappings = useAction(
		api.categorization.populateMerchantMappingsFromExpenses,
	);
	const categorizeExpenses = useAction(
		api.categorization.categorizeExistingExpenses,
	);
	const jobQueueStats = useQuery(api.expenses.getJobQueueStats);
	const rateLimitStatus = useQuery(api.expenses.getRateLimitStatus);
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isScanning, setIsScanning] = useState(false);
	const [isCategorizing, setIsCategorizing] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [scanStatus, setScanStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [categorizeStatus, setCategorizeStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [categorizationProgress, setCategorizationProgress] = useState<{
		status: "idle" | "categorizing" | "completed" | "partial" | "failed";
		currentFile: number;
		totalFiles: number;
		categorizedCount: number;
		totalExpenses: number;
		failedMerchants: string[];
		totalMerchants: number;
		categorizedFromCache: number;
		categorizedFromAI: number;
		retriedMerchants: number;
		totalRetryAttempts: number;
	}>({
		status: "idle",
		currentFile: 0,
		totalFiles: 0,
		categorizedCount: 0,
		totalExpenses: 0,
		failedMerchants: [],
		totalMerchants: 0,
		categorizedFromCache: 0,
		categorizedFromAI: 0,
		retriedMerchants: 0,
		totalRetryAttempts: 0,
	});

	const handleFiles = useCallback(
		async (files: File[]) => {
			setIsUploading(true);
			setUploadStatus(null);

			// Initialize categorization progress
			setCategorizationProgress({
				status: "categorizing",
				currentFile: 0,
				totalFiles: files.length,
				categorizedCount: 0,
				totalExpenses: 0,
				failedMerchants: [],
				totalMerchants: 0,
				categorizedFromCache: 0,
				categorizedFromAI: 0,
				retriedMerchants: 0,
				totalRetryAttempts: 0,
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
					setCategorizationProgress((prev) => ({
						...prev,
						status: "failed",
					}));
					return;
				}

				// Process each file result
				let totalExpenses = 0;
				let totalErrors = 0;
				let totalCategorized = 0;
				let totalMerchants = 0;
				let totalFromCache = 0;
				let totalFromAI = 0;
				let totalRetried = 0;
				let totalRetryAttempts = 0;
				const allFailedMerchants: string[] = [];
				let earliestNewMonth: { year: number; month: string } | null = null;
				let fileIndex = 0;

				for (const fileResult of result.files) {
					fileIndex++;

					// Update progress for current file
					setCategorizationProgress((prev) => ({
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

						// Add expenses to Convex with automatic categorization (Phase 2: with retry)
						const addResult = await addExpensesWithCategories({ expenses });
						totalExpenses += addResult.addedCount;
						totalCategorized += addResult.categorizedCount || 0;
						totalMerchants += addResult.totalMerchants || 0;
						totalFromCache += addResult.categorizedFromCache || 0;
						totalFromAI += addResult.categorizedFromAI || 0;
						totalRetried += addResult.retriedMerchants || 0;
						totalRetryAttempts += addResult.totalRetryAttempts || 0;

						// Track failed merchants
						if (
							addResult.failedMerchants &&
							addResult.failedMerchants.length > 0
						) {
							allFailedMerchants.push(...addResult.failedMerchants);
						}

						// Update progress with categorization results (Phase 2: enhanced stats)
						setCategorizationProgress((prev) => ({
							...prev,
							categorizedCount: totalCategorized,
							totalExpenses: totalExpenses,
							totalMerchants: totalMerchants,
							failedMerchants: allFailedMerchants,
							categorizedFromCache: totalFromCache,
							categorizedFromAI: totalFromAI,
							retriedMerchants: totalRetried,
							totalRetryAttempts: totalRetryAttempts,
						}));

						// Track earliest new month
						if (addResult.addedCount > 0) {
							for (const expense of expenses) {
								if (
									!earliestNewMonth ||
									expense.year < earliestNewMonth.year ||
									(expense.year === earliestNewMonth.year &&
										expense.month < earliestNewMonth.month)
								) {
									earliestNewMonth = {
										year: expense.year,
										month: expense.month,
									};
								}
							}
						}
					} else {
						totalErrors++;
					}
				}

				if (totalErrors > 0 && totalExpenses === 0) {
					setUploadStatus({
						type: "error",
						message: `Failed to parse ${totalErrors} file(s)`,
					});
					setCategorizationProgress((prev) => ({
						...prev,
						status: "failed",
					}));
				} else {
					setUploadStatus({
						type: "success",
						message: `Successfully added ${totalExpenses} expense(s)${
							totalErrors > 0 ? ` (${totalErrors} file(s) had errors)` : ""
						}`,
					});

					// Determine final categorization status
					const categorizationStatus =
						totalCategorized === totalExpenses &&
						allFailedMerchants.length === 0
							? "completed"
							: allFailedMerchants.length > 0
								? "partial"
								: "completed";

					setCategorizationProgress((prev) => ({
						...prev,
						status: categorizationStatus,
					}));
				}
			} catch (error) {
				setUploadStatus({
					type: "error",
					message: error instanceof Error ? error.message : "Upload failed",
				});
				setCategorizationProgress((prev) => ({
					...prev,
					status: "failed",
				}));
			} finally {
				setIsUploading(false);
			}
		},
		[addExpensesWithCategories, recordUpload],
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

	const handleScanExpenses = useCallback(async () => {
		setIsScanning(true);
		setScanStatus(null);

		try {
			const result = await populateMappings();

			setScanStatus({
				type: "success",
				message: `Scan complete: Processed ${result.processedMerchants} merchants, Created ${result.createdMappings} new mappings, Updated ${result.updatedMappings} existing mappings`,
			});
		} catch (error) {
			setScanStatus({
				type: "error",
				message: error instanceof Error ? error.message : "Scan failed",
			});
		} finally {
			setIsScanning(false);
		}
	}, [populateMappings]);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			{/* Categorization Progress Banner */}
			{categorizationProgress.status !== "idle" && (
				<div
					className={`fixed top-0 left-0 right-0 z-50 shadow-lg transition-all ${
						categorizationProgress.status === "categorizing"
							? "bg-blue-500/90 backdrop-blur-sm"
							: categorizationProgress.status === "completed"
								? "bg-green-500/90 backdrop-blur-sm"
								: categorizationProgress.status === "partial"
									? "bg-yellow-500/90 backdrop-blur-sm"
									: "bg-red-500/90 backdrop-blur-sm"
					}`}
				>
					<div className="max-w-4xl mx-auto px-6 py-4">
						<div className="flex items-center justify-between gap-4">
							<div className="flex-1">
								{categorizationProgress.status === "categorizing" && (
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<RefreshCw className="w-5 h-5 animate-spin text-white" />
											<span className="text-white font-semibold">
												Categorizing expenses...
											</span>
										</div>
										<p className="text-sm text-white/90">
											Processing file {categorizationProgress.currentFile} of{" "}
											{categorizationProgress.totalFiles} •{" "}
											{categorizationProgress.categorizedCount}/
											{categorizationProgress.totalExpenses} expenses
											categorized • {categorizationProgress.totalMerchants}{" "}
											unique merchants
										</p>
									</div>
								)}

								{categorizationProgress.status === "completed" && (
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-white"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M5 13l4 4L19 7"
												/>
											</svg>
											<span className="text-white font-semibold">
												Categorization complete!
											</span>
										</div>
										<p className="text-sm text-white/90">
											Successfully categorized{" "}
											{categorizationProgress.categorizedCount} expenses across{" "}
											{categorizationProgress.totalMerchants} merchants
											{categorizationProgress.categorizedFromCache > 0 && (
												<span className="block text-xs text-white/70 mt-1">
													{categorizationProgress.categorizedFromCache} from cache •{" "}
													{categorizationProgress.categorizedFromAI} from AI
													{categorizationProgress.retriedMerchants > 0 && (
														<> • {categorizationProgress.retriedMerchants} retried ({categorizationProgress.totalRetryAttempts} retry attempts)</>
													)}
												</span>
											)}
										</p>
									</div>
								)}

								{categorizationProgress.status === "partial" && (
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-white"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
												/>
											</svg>
											<span className="text-white font-semibold">
												Categorization partially complete
											</span>
										</div>
										<p className="text-sm text-white/90">
											Categorized {categorizationProgress.categorizedCount}/
											{categorizationProgress.totalExpenses} expenses •{" "}
											{categorizationProgress.failedMerchants.length} merchants
											failed (
											{categorizationProgress.failedMerchants.join(", ")})
										</p>
										<p className="text-xs text-white/80">
											Failed merchants were likely rate-limited and can be
											categorized manually or by running the admin tool later.
										</p>
									</div>
								)}

								{categorizationProgress.status === "failed" && (
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<svg
												className="w-5 h-5 text-white"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
											<span className="text-white font-semibold">
												Categorization failed
											</span>
										</div>
										<p className="text-sm text-white/90">
											Unable to categorize expenses. Check upload status below.
										</p>
									</div>
								)}
							</div>

							{/* Dismiss button (only show when not actively categorizing) */}
							{categorizationProgress.status !== "categorizing" && (
								<button
									type="button"
									onClick={() =>
										setCategorizationProgress({
											status: "idle",
											currentFile: 0,
											totalFiles: 0,
											categorizedCount: 0,
											totalExpenses: 0,
											failedMerchants: [],
											totalMerchants: 0,
											categorizedFromCache: 0,
											categorizedFromAI: 0,
											retriedMerchants: 0,
											totalRetryAttempts: 0,
										})
									}
									className="text-white hover:text-white/80 transition-colors"
									aria-label="Dismiss banner"
								>
									<svg
										className="w-5 h-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			<div
				className={`max-w-4xl mx-auto ${categorizationProgress.status !== "idle" ? "mt-24" : ""}`}
			>
				<h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
					Expense Splitter
				</h1>
				<p className="text-gray-400 text-center mb-12">
					Upload PDF or CSV statements to track and split expenses 50/50
				</p>

				{/* Upload Area */}
				<div
					role="button"
					tabIndex={0}
					className={`border-2 border-dashed rounded-xl p-12 mb-12 transition-all ${
						isDragging
							? "border-cyan-500 bg-cyan-500/10"
							: "border-slate-600 bg-slate-800/50"
					}`}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<div className="flex flex-col items-center justify-center text-center">
						<Upload
							className={`w-16 h-16 mb-4 ${
								isDragging ? "text-cyan-400" : "text-gray-400"
							}`}
						/>
						<h3 className="text-xl font-semibold text-white mb-2">
							{isDragging ? "Drop files here" : "Upload Expense Files"}
						</h3>
						<p className="text-gray-400 mb-4">
							Drag and drop PDF or CSV files or click to browse
						</p>
						<label
							htmlFor="file-upload"
							className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors cursor-pointer"
						>
							{isUploading ? "Uploading..." : "Choose Files"}
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

				{/* Upload Status */}
				{uploadStatus && (
					<div
						className={`mb-8 p-4 rounded-lg ${
							uploadStatus.type === "success"
								? "bg-green-500/10 border border-green-500/50 text-green-400"
								: "bg-red-500/10 border border-red-500/50 text-red-400"
						}`}
					>
						{uploadStatus.message}
					</div>
				)}

				{/* Monthly Expenses Chart */}
				<div className="mb-8">
					<MonthlyExpensesChart />
				</div>

				{/* Years List */}
				<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 mb-8">
					<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
						<Calendar className="w-6 h-6" />
						Expense Years
					</h2>

					{years === undefined ? (
						<p className="text-gray-400">Loading...</p>
					) : years.length === 0 ? (
						<p className="text-gray-400">
							No expenses yet. Upload a PDF or CSV file to get started.
						</p>
					) : (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
							{years.map((year) => (
								<Link
									key={year}
									to="/$year"
									params={{ year: year.toString() }}
									className="bg-slate-700/50 hover:bg-cyan-500/20 border border-slate-600 hover:border-cyan-500 rounded-lg p-6 text-center transition-all group"
								>
									<div className="text-3xl font-bold text-white group-hover:text-cyan-400 transition-colors">
										{year}
									</div>
								</Link>
							))}
						</div>
					)}
				</div>

				{/* Phase 3: Job Queue Status */}
				{jobQueueStats && (jobQueueStats.pending > 0 || jobQueueStats.processing > 0 || jobQueueStats.failed > 0) && (
					<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8 mb-8">
						<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
							<RefreshCw className={`w-6 h-6 ${jobQueueStats.processing > 0 ? "animate-spin text-cyan-400" : "text-gray-400"}`} />
							Background Categorization Queue
						</h2>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="text-gray-400 text-sm mb-1">Pending</div>
								<div className="text-2xl font-bold text-yellow-400">{jobQueueStats.pending}</div>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="text-gray-400 text-sm mb-1">Processing</div>
								<div className="text-2xl font-bold text-cyan-400">{jobQueueStats.processing}</div>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="text-gray-400 text-sm mb-1">Completed</div>
								<div className="text-2xl font-bold text-green-400">{jobQueueStats.completed}</div>
							</div>
							<div className="bg-slate-700/50 rounded-lg p-4">
								<div className="text-gray-400 text-sm mb-1">Failed</div>
								<div className="text-2xl font-bold text-red-400">{jobQueueStats.failed}</div>
							</div>
						</div>
						{jobQueueStats.retryable > 0 && (
							<div className="mt-4 text-sm text-gray-400">
								{jobQueueStats.retryable} failed job(s) ready for retry
							</div>
						)}
					</div>
				)}

				{/* Admin Tools */}
				<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
					<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
						<RefreshCw className="w-6 h-6" />
						Admin Tools
					</h2>

					<div className="space-y-6">
						{/* Step 1: Categorize Expenses */}
						<div>
							<h3 className="text-lg font-semibold text-white mb-2">
								Step 1: Categorize Existing Expenses
							</h3>
							<p className="text-gray-400 mb-4">
								Add AI categories to expenses that don't have them yet. Run this
								first if you have old expenses without categories.
							</p>
							<p className="text-sm text-yellow-400 mb-4">
								⚠️ Rate Limit: 16 requests/minute (free tier). Automatically adds
								4 second delays between requests to stay under limit.
							</p>
							<button
								type="button"
								onClick={handleCategorizeExpenses}
								disabled={isCategorizing}
								className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
							>
								<RefreshCw
									className={`w-5 h-5 ${isCategorizing ? "animate-spin" : ""}`}
								/>
								{isCategorizing
									? "Categorizing..."
									: "Categorize Uncategorized Expenses"}
							</button>
						</div>

						{categorizeStatus && (
							<div
								className={`p-4 rounded-lg ${
									categorizeStatus.type === "success"
										? "bg-green-500/10 border border-green-500/50 text-green-400"
										: "bg-red-500/10 border border-red-500/50 text-red-400"
								}`}
							>
								{categorizeStatus.message}
							</div>
						)}

						{/* Step 2: Build Mappings */}
						<div>
							<h3 className="text-lg font-semibold text-white mb-2">
								Step 2: Rebuild Merchant Mappings
							</h3>
							<p className="text-gray-400 mb-4">
								Scan categorized expenses to build merchant category mappings.
								This helps improve auto-categorization for future uploads.
							</p>
							<button
								type="button"
								onClick={handleScanExpenses}
								disabled={isScanning}
								className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
							>
								<RefreshCw
									className={`w-5 h-5 ${isScanning ? "animate-spin" : ""}`}
								/>
								{isScanning
									? "Scanning Expenses..."
									: "Rebuild Merchant Mappings"}
							</button>
						</div>

						{scanStatus && (
							<div
								className={`p-4 rounded-lg ${
									scanStatus.type === "success"
										? "bg-green-500/10 border border-green-500/50 text-green-400"
										: "bg-red-500/10 border border-red-500/50 text-red-400"
								}`}
							>
								{scanStatus.message}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
