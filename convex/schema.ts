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
		category: v.optional(v.string()), // Expense category
		merchantName: v.optional(v.string()), // Normalized merchant name (e.g., "WOOLWORTHS")
	}).index("by_expense_id", ["expenseId"]),
	uploads: defineTable({
		filename: v.string(),
		size: v.number(),
		uploadDate: v.number(), // Timestamp
		status: v.string(), // "success" or "error"
		errorMessage: v.optional(v.string()),
	}),
	// Global merchant-to-category mappings (crowd-sourced)
	merchantMappings: defineTable({
		merchantName: v.string(), // Normalized merchant name (e.g., "WOOLWORTHS")
		category: v.string(), // Most common category
		confidence: v.string(), // "ai" | "user" | "consensus"
		voteCount: v.number(), // Number of user confirmations
		categoryVotes: v.optional(v.any()), // JSON object tracking votes per category (dynamic keys)
		aiSuggestion: v.optional(v.string()), // Original AI suggestion
		lastUpdated: v.number(), // Timestamp
	}).index("by_merchant", ["merchantName"]),
	// Personal merchant overrides (user-specific categorization)
	personalMappings: defineTable({
		userId: v.string(), // User ID (or anonymous device ID for now)
		merchantName: v.string(), // Normalized merchant name
		category: v.string(), // User's preferred category
		createdAt: v.number(), // Timestamp
	}).index("by_user_merchant", ["userId", "merchantName"]),
	// Custom user-created categories
	customCategories: defineTable({
		name: v.string(), // Category name
		createdAt: v.number(), // Timestamp
	}).index("by_name", ["name"]),
	// Background categorization job queue (Phase 3)
	categorizationJobs: defineTable({
		expenseId: v.string(), // Expense to categorize
		merchantName: v.string(), // Normalized merchant name
		description: v.string(), // Expense description for AI context
		userId: v.optional(v.string()), // User ID for personal mappings
		status: v.string(), // "pending" | "processing" | "completed" | "failed"
		attempts: v.number(), // Number of attempts made
		lastAttempt: v.optional(v.number()), // Timestamp of last attempt
		nextRetry: v.optional(v.number()), // Timestamp when job can be retried
		error: v.optional(v.string()), // Error message if failed
		createdAt: v.number(), // Timestamp
	})
		.index("by_status", ["status"])
		.index("by_next_retry", ["nextRetry"])
		.index("by_expense_id", ["expenseId"]),
	// Rate limit tracking (Phase 3)
	rateLimitState: defineTable({
		provider: v.string(), // API provider (e.g., "openrouter")
		requestCount: v.number(), // Number of requests in current window
		windowStart: v.number(), // Start of current time window
		lastReset: v.number(), // Last time counter was reset
		lastRequest: v.optional(v.number()), // Timestamp of last request
	}).index("by_provider", ["provider"]),
})
