import {
	SignInButton,
	SignedIn,
	SignedOut,
	UserButton,
} from "@clerk/tanstack-start";
import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { DollarSign } from "lucide-react";
import { api } from "../../convex/_generated/api";

export default function Header() {
	const stats = useQuery(api.categorization.getAdminDashboardStats);

	return (
		<header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
			<SignedOut>
				<Link to="/" className="flex items-center gap-3">
					<DollarSign className="w-8 h-8 text-cyan-400" />
					<h1 className="text-xl font-semibold">Luman</h1>
				</Link>
			</SignedOut>

			<SignedIn>
				<Link to="/dashboard" className="flex items-center gap-3">
					<DollarSign className="w-8 h-8 text-cyan-400" />
					<h1 className="text-xl font-semibold">Luman</h1>
				</Link>
			</SignedIn>

			<div className="flex items-center gap-4">
				<SignedIn>
					<Link
						to="/admin"
						className="relative text-gray-300 hover:text-white transition-colors"
						activeProps={{ className: "text-cyan-400" }}
					>
						<span className="font-medium">Admin</span>
						{stats?.needsAttention && (
							<span className="absolute -top-2 -right-2 h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-xs text-white flex items-center justify-center animate-pulse">
								{stats.expenses.uncategorized}
							</span>
						)}
					</Link>
				</SignedIn>

				<SignedOut>
					<SignInButton mode="modal">
						<button
							type="button"
							className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md font-medium transition-colors"
						>
							Sign In
						</button>
					</SignInButton>
				</SignedOut>

				<SignedIn>
					<UserButton
						appearance={{
							elements: {
								avatarBox: "w-10 h-10",
							},
						}}
					/>
				</SignedIn>
			</div>
		</header>
	);
}
