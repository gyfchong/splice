import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Calendar, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import type { ParsedExpense } from "@/lib/pdf-parser";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
	const years = useQuery(api.expenses.getYears);
	const addExpenses = useMutation(api.expenses.addExpenses);
	const recordUpload = useMutation(api.expenses.recordUpload);
	const navigate = useNavigate();
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const handleFiles = useCallback(
		async (files: File[]) => {
			setIsUploading(true);
			setUploadStatus(null);

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
					return;
				}

				// Process each file result
				let totalExpenses = 0;
				let totalErrors = 0;
				let earliestNewMonth: { year: number; month: string } | null = null;

				for (const fileResult of result.files) {
					// Record upload metadata
					await recordUpload({
						filename: fileResult.filename,
						size: fileResult.size,
						status: fileResult.status,
						errorMessage: fileResult.errorMessage,
					});

					if (fileResult.status === "success" && fileResult.expenses) {
						const expenses = fileResult.expenses as ParsedExpense[];

						// Add expenses to Convex
						const addResult = await addExpenses({ expenses });
						totalExpenses += addResult.addedCount;

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
				} else {
					setUploadStatus({
						type: "success",
						message: `Successfully added ${totalExpenses} expense(s)${
							totalErrors > 0 ? ` (${totalErrors} file(s) had errors)` : ""
						}`,
					});

					// Navigate to the earliest new month if we added expenses
					if (earliestNewMonth) {
						const targetYear = earliestNewMonth.year;
						setTimeout(() => {
							navigate({
								to: "/year/$year",
								params: { year: targetYear.toString() },
							});
						}, 1500);
					}
				}
			} catch (error) {
				setUploadStatus({
					type: "error",
					message: error instanceof Error ? error.message : "Upload failed",
				});
			} finally {
				setIsUploading(false);
			}
		},
		[addExpenses, recordUpload, navigate],
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
				(file) => file.type === "application/pdf",
			);

			if (files.length === 0) {
				setUploadStatus({
					type: "error",
					message: "Please upload only PDF files",
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
				(file) => file.type === "application/pdf",
			);

			if (files.length === 0) {
				setUploadStatus({
					type: "error",
					message: "Please upload only PDF files",
				});
				return;
			}

			await handleFiles(files);
		},
		[handleFiles],
	);

	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
			<div className="max-w-4xl mx-auto">
				<h1 className="text-4xl md:text-5xl font-bold text-white mb-4 text-center">
					Expense Splitter
				</h1>
				<p className="text-gray-400 text-center mb-12">
					Upload PDF statements to track and split expenses 50/50
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
							{isDragging ? "Drop PDF files here" : "Upload Expense PDFs"}
						</h3>
						<p className="text-gray-400 mb-4">
							Drag and drop PDF files or click to browse
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
							accept=".pdf"
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

				{/* Years List */}
				<div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
					<h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
						<Calendar className="w-6 h-6" />
						Expense Years
					</h2>

					{years === undefined ? (
						<p className="text-gray-400">Loading...</p>
					) : years.length === 0 ? (
						<p className="text-gray-400">
							No expenses yet. Upload a PDF to get started.
						</p>
					) : (
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
							{years.map((year) => (
								<Link
									key={year}
									to="/year/$year"
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
			</div>
		</div>
	);
}
