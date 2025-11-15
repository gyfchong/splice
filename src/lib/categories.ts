/**
 * Expense categories
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
] as const

export type Category = (typeof CATEGORIES)[number]

/**
 * Check if a string is a valid category
 */
export function isValidCategory(category: string): category is Category {
	return CATEGORIES.includes(category as Category)
}
