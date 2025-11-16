import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { DollarSign } from "lucide-react";
import { api } from "../../convex/_generated/api";

export default function Header() {
	const stats = useQuery(api.categorization.getAdminDashboardStats);

	return (
		<header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
			<Link to="/" className="flex items-center gap-3">
				<DollarSign className="w-8 h-8 text-cyan-400" />
				<h1 className="text-xl font-semibold">Expense Splitter</h1>
			</Link>

			{/* Conditional Admin Link with Badge */}
			{stats?.needsAttention && (
				<Link
					to="/admin"
					className="relative text-gray-300 hover:text-white transition-colors"
					activeProps={{ className: "text-cyan-400" }}
				>
					<span className="font-medium">Admin</span>
					<span className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center animate-pulse">
						{stats.expenses.uncategorized}
					</span>
				</Link>
			)}
		</header>
	);
}
