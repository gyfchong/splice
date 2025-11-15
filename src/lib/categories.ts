import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Default expense categories
 */
export const CATEGORIES = [
	"Groceries",
	"Dining & Takeaway",
	"Transport",
	"Fuel",
	"Entertainment",
	"Shopping",
	"Bills & Utilities",
	"Health & Medical",
	"Home & Garden",
	"Education",
	"Travel",
	"Hobbies",
	"Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/**
 * Check if a string is a valid default category
 */
export function isValidCategory(category: string): category is Category {
	return CATEGORIES.includes(category as Category);
}

/**
 * Hook to get all categories that are actually used in expenses
 */
export function useAllCategories(): string[] {
	const usedCategories = useQuery(api.categorization.getUsedCategories);

	if (usedCategories === undefined) {
		// Return empty array while loading
		return [];
	}

	// Return only used categories
	return usedCategories;
}
