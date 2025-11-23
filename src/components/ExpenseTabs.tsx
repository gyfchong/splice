type TabType = "all" | "mine" | "shared" | "other";

interface ExpenseTabsProps {
	totals: {
		all: number;
		mine: number;
		shared: number;
		other?: number;
	};
	counts: {
		all: number;
		mine: number;
		shared: number;
		other?: number;
	};
	activeTab: TabType;
	onTabChange: (tab: TabType) => void;
}

export function ExpenseTabs({
	totals,
	counts,
	activeTab,
	onTabChange,
}: ExpenseTabsProps) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	};

	const tabs = [
		{
			id: "all" as TabType,
			label: "All",
			total: totals.all,
			count: counts.all,
			icon: "💰",
			description: "Total personal spending",
		},
		{
			id: "mine" as TabType,
			label: "Mine",
			total: totals.mine,
			count: counts.mine,
			icon: "👤",
			description: "100% individual expenses",
		},
		{
			id: "shared" as TabType,
			label: "Shared",
			total: totals.shared,
			count: counts.shared,
			icon: "👥",
			description: "50% of split expenses",
		},
		{
			id: "other" as TabType,
			label: "Theirs",
			total: totals.other ?? 0,
			count: counts.other ?? 0,
			icon: "🤝",
			description: "0% (paid for others)",
		},
	];

	return (
		<div className="mb-6">
			<div className="grid grid-cols-4 gap-3">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => onTabChange(tab.id)}
						type="button"
						className={`
              p-4 rounded-xl border-2 transition-all text-left
              ${activeTab === tab.id ? "border-cyan-500 bg-cyan-500/10" : "border-slate-600 bg-slate-800/30 hover:border-slate-500"}
            `}
					>
						<div className="flex items-center gap-2 mb-2">
							<span className="text-xl">{tab.icon}</span>
							<span className="font-semibold text-white">{tab.label}</span>
							<span className="text-sm text-gray-400">({tab.count})</span>
						</div>
						<div
							className={`text-2xl font-bold ${activeTab === tab.id ? "text-cyan-400" : "text-white"}`}
						>
							{formatCurrency(tab.total)}
						</div>
						<div className="text-xs text-gray-400 mt-1">{tab.description}</div>
					</button>
				))}
			</div>
		</div>
	);
}
