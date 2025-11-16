import { Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

interface UploadProgress {
	status: "uploading" | "completed";
	current: number;
	total: number;
	yearMonth: string;
}

export function FloatingProgressBar() {
	const [progress, setProgress] = useState<UploadProgress | null>(null);

	useEffect(() => {
		// Check for ongoing upload on mount
		const stored = localStorage.getItem("uploadProgress");
		if (stored) {
			const data = JSON.parse(stored) as UploadProgress;
			if (data.status === "uploading") {
				setProgress(data);
			}
		}

		// Listen for progress updates
		const handleStorageChange = () => {
			const stored = localStorage.getItem("uploadProgress");
			if (stored) {
				const data = JSON.parse(stored) as UploadProgress;
				setProgress(data);

				// Auto-hide after completion
				if (data.status === "completed") {
					setTimeout(() => {
						setProgress(null);
						localStorage.removeItem("uploadProgress");
					}, 2000);
				}
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, []);

	const handleClose = () => {
		setProgress(null);
		localStorage.removeItem("uploadProgress");
	};

	if (!progress) return null;

	const percentage = (progress.current / progress.total) * 100;
	const isComplete = progress.status === "completed";

	return (
		<div className="fixed top-0 left-0 right-0 z-50 animate-slide-down">
			<div className="bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg">
				<div className="max-w-6xl mx-auto px-6 py-3">
					<div className="flex items-center gap-4">
						<Upload
							className={`w-5 h-5 text-white ${!isComplete ? "animate-pulse" : ""}`}
						/>
						<div className="flex-1">
							<div className="flex items-center justify-between mb-1">
								<span className="text-white font-semibold text-sm">
									{isComplete
										? "Upload complete!"
										: `Uploading expenses... ${progress.current} of ${progress.total}`}
								</span>
								<button
									type="button"
									onClick={handleClose}
									className="text-white/80 hover:text-white transition-colors"
									aria-label="Close"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
							<div className="h-2 bg-white/20 rounded-full overflow-hidden">
								<div
									className="h-full bg-white transition-all duration-300 ease-out rounded-full"
									style={{ width: `${percentage}%` }}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
