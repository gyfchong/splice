import { useMutation } from "convex/react";
import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAllCategories } from "@/lib/categories";
import { api } from "../../convex/_generated/api";

interface CategorySelectProps {
	value: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	className?: string;
}

const CUSTOM_OPTION = "__custom__";

export function CategorySelect({
	value,
	onValueChange,
	disabled = false,
	className = "w-48 h-8 bg-slate-700/50 border-slate-600 text-sm",
}: CategorySelectProps) {
	const allCategories = useAllCategories();
	const addCustomCategory = useMutation(api.categorization.addCustomCategory);

	const [showCustomInput, setShowCustomInput] = useState(false);
	const [customCategoryName, setCustomCategoryName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSelectChange = (newValue: string) => {
		if (newValue === CUSTOM_OPTION) {
			setShowCustomInput(true);
			setCustomCategoryName("");
			setError(null);
		} else {
			onValueChange(newValue);
		}
	};

	const handleSaveCustomCategory = async () => {
		if (!customCategoryName.trim()) {
			setError("Category name cannot be empty");
			return;
		}

		setIsCreating(true);
		setError(null);

		try {
			const newCategory = await addCustomCategory({
				name: customCategoryName.trim(),
			});
			// Update the parent component with the new category
			onValueChange(newCategory);
			// Hide the input
			setShowCustomInput(false);
			setCustomCategoryName("");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to create category",
			);
		} finally {
			setIsCreating(false);
		}
	};

	const handleCancelCustomCategory = () => {
		setShowCustomInput(false);
		setCustomCategoryName("");
		setError(null);
	};

	if (showCustomInput) {
		return (
			<div className="flex items-center gap-2">
				<div className="flex flex-col gap-1">
					<div className="flex items-center gap-2">
						<Input
							type="text"
							value={customCategoryName}
							onChange={(e) => setCustomCategoryName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleSaveCustomCategory();
								} else if (e.key === "Escape") {
									handleCancelCustomCategory();
								}
							}}
							placeholder="Enter category name..."
							disabled={isCreating}
							className="w-48 h-8 bg-slate-700/50 border-slate-600 text-sm"
							autoFocus
						/>
						<Button
							size="sm"
							onClick={handleSaveCustomCategory}
							disabled={isCreating || !customCategoryName.trim()}
							className="h-8 px-2 bg-cyan-500 hover:bg-cyan-600"
						>
							{isCreating ? (
								<Loader2 className="w-4 h-4 animate-spin" />
							) : (
								<Check className="w-4 h-4" />
							)}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={handleCancelCustomCategory}
							disabled={isCreating}
							className="h-8 px-2"
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
					{error && <span className="text-xs text-red-400">{error}</span>}
				</div>
			</div>
		);
	}

	return (
		<Select
			value={value}
			onValueChange={handleSelectChange}
			disabled={disabled}
		>
			<SelectTrigger className={className}>
				<SelectValue placeholder="Select category" />
			</SelectTrigger>
			<SelectContent>
				{allCategories.map((category) => (
					<SelectItem key={category} value={category}>
						{category}
					</SelectItem>
				))}
				<SelectItem value={CUSTOM_OPTION} className="text-cyan-400 font-medium">
					Custom...
				</SelectItem>
			</SelectContent>
		</Select>
	);
}
