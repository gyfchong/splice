import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
	expenses: defineTable({
		expenseId: v.string(), // Unique ID for deduplication
		name: v.string(),
		amount: v.number(),
		date: v.string(), // YYYY-MM-DD format
		checked: v.boolean(),
		year: v.number(),
		month: v.string(), // 2-digit format: "01", "02", etc.
	}).index("by_expense_id", ["expenseId"]),
	uploads: defineTable({
		filename: v.string(),
		size: v.number(),
		uploadDate: v.number(), // Timestamp
		status: v.string(), // "success" or "error"
		errorMessage: v.optional(v.string()),
	}),
})
