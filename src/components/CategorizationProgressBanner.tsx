import { useQuery } from "convex/react";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

/**
 * Persistent banner that shows categorization progress
 * Displays when there are pending/processing categorization jobs
 * Can be dismissed but reappears on page reload if jobs still exist
 */
export function CategorizationProgressBanner() {
	const jobStats = useQuery(api.expenses.getJobQueueStats);
	const [isDismissed, setIsDismissed] = useState(false);

	// Don't show if dismissed or no jobs to process
	if (
		isDismissed ||
		!jobStats ||
		(jobStats.pending === 0 &&
			jobStats.processing === 0 &&
			jobStats.failed === 0)
	) {
		return null;
	}

	const totalJobs = jobStats.pending + jobStats.processing + jobStats.failed;
	const isProcessing = jobStats.processing > 0;

	// Calculate estimated time (very rough estimate)
	// Background worker processes ~1 job per 5 seconds
	const estimatedMinutes = Math.ceil((jobStats.pending + jobStats.failed) / 12);
	const estimatedTimeText =
		estimatedMinutes < 1
			? "less than a minute"
			: estimatedMinutes === 1
				? "about 1 minute"
				: `about ${estimatedMinutes} minutes`;

	return (
		<div className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between py-3">
					<div className="flex items-center gap-3 flex-1">
						<RefreshCw
							className={`w-5 h-5 text-white flex-shrink-0 ${
								isProcessing ? "animate-spin" : ""
							}`}
						/>
						<div className="flex-1">
							<div className="flex items-center gap-2">
								<span className="text-white font-semibold">
									Categorizing expenses...
								</span>
								<span className="text-white/80 text-sm">
									{jobStats.pending} pending
									{jobStats.processing > 0 &&
										`, ${jobStats.processing} in progress`}
									{jobStats.failed > 0 && `, ${jobStats.failed} failed`}
								</span>
							</div>
							<p className="text-white/70 text-xs mt-0.5">
								Background worker is processing {totalJobs} job
								{totalJobs === 1 ? "" : "s"}. Estimated time:{" "}
								{estimatedTimeText}
							</p>
						</div>
					</div>

					{/* Dismiss button */}
					<button
						type="button"
						onClick={() => setIsDismissed(true)}
						className="ml-4 p-1 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white flex-shrink-0"
						aria-label="Dismiss notification"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Progress bar */}
				{jobStats.completed > 0 && (
					<div className="pb-2">
						<div className="bg-white/20 rounded-full h-1.5 overflow-hidden">
							<div
								className="bg-white h-full transition-all duration-500"
								style={{
									width: `${(jobStats.completed / (jobStats.completed + totalJobs)) * 100}%`,
								}}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
