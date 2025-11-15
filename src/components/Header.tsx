import { Link } from "@tanstack/react-router";
import { DollarSign } from "lucide-react";

export default function Header() {
	return (
		<header className="p-4 flex items-center bg-gray-800 text-white shadow-lg">
			<Link to="/" className="flex items-center gap-3">
				<DollarSign className="w-8 h-8 text-cyan-400" />
				<h1 className="text-xl font-semibold">Expense Splitter</h1>
			</Link>
		</header>
	);
}
