import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	expenses: defineTable({
		expenseId: v.string(), // Unique ID for deduplication
		name: v.string(),
		amount: v.number(),
		date: v.string(), // YYYY-MM-DD format
		checked: v.boolean(),
		split: v.optional(v.boolean()), // Whether expense is split (50/50) or not (100%), defaults to true
		year: v.number(),
		month: v.string(), // 2-digit format: "01", "02", etc.
		uploadTimestamp: v.optional(v.number()), // When expense was added (for unseen tracking)
	}).index("by_expense_id", ["expenseId"]),
	uploads: defineTable({
		filename: v.string(),
		size: v.number(),
		uploadDate: v.number(), // Timestamp
		status: v.string(), // "success" or "error"
		errorMessage: v.optional(v.string()),
	}),
})
