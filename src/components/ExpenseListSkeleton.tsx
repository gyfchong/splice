export function ExpenseListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: skeleton items are static placeholders
					key={index}
					className="p-4 rounded-lg bg-slate-700/30 border border-slate-600/30 animate-pulse"
				>
					{/* Main row: checkbox, name, amount, toggle */}
					<div className="flex items-center gap-4 mb-3">
						{/* Checkbox skeleton */}
						<div className="w-5 h-5 rounded bg-slate-600/50 shrink-0" />

						<div className="flex-1 min-w-0">
							{/* Name skeleton */}
							<div className="h-5 bg-slate-600/50 rounded w-3/4 mb-2" />
							{/* Date skeleton */}
							<div className="h-4 bg-slate-600/30 rounded w-1/4" />
						</div>

						<div className="shrink-0 text-right">
							{/* Amount skeleton */}
							<div className="h-6 bg-slate-600/50 rounded w-20 mb-1" />
							{/* Share info skeleton */}
							<div className="h-3 bg-slate-600/30 rounded w-16" />
						</div>

						{/* Toggle skeleton */}
						<div className="flex items-center gap-2 shrink-0">
							<div className="w-4 h-4 rounded-full bg-slate-600/50" />
							<div className="w-11 h-6 rounded-full bg-slate-600/50" />
						</div>
					</div>

					{/* Category row skeleton */}
					<div className="flex items-center gap-2 ml-9">
						<div className="w-4 h-4 rounded bg-slate-600/30 shrink-0" />
						<div className="h-9 bg-slate-600/30 rounded w-40" />
					</div>
				</div>
			))}
		</div>
	);
}
