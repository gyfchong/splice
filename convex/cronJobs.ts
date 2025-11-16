/**
 * Scheduled cron jobs for maintenance tasks (Phase 3)
 *
 * Daily jobs for cleanup and catching up on uncategorized expenses.
 */

import { internalAction, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { categorizeByHeuristics } from "./heuristics"

/**
 * Finds all uncategorized expenses
 * Returns expenses that don't have a category field or have null/empty category
 */
export const findUncategorizedExpenses = internalQuery({
	args: {},
	handler: async (ctx) => {
		const allExpenses = await ctx.db.query("expenses").collect()

		// Filter to uncategorized expenses
		const uncategorized = allExpenses.filter(
			(expense) => !expense.category || expense.category.trim() === "",
		)

		// Group by merchant for efficiency
		const merchantGroups = new Map<
			string,
			Array<{ expenseId: string; merchantName: string; name: string }>
		>()

		for (const expense of uncategorized) {
			const merchantName = expense.merchantName || "UNKNOWN"
			if (!merchantGroups.has(merchantName)) {
				merchantGroups.set(merchantName, [])
			}
			merchantGroups.get(merchantName)?.push({
				expenseId: expense.expenseId,
				merchantName,
				name: expense.name,
			})
		}

		return {
			totalUncategorized: uncategorized.length,
			uniqueMerchants: merchantGroups.size,
			merchantGroups: Array.from(merchantGroups.entries()).map(([merchant, expenses]) => ({
				merchantName: merchant,
				expenseCount: expenses.length,
				expenses,
			})),
		}
	},
})

/**
 * Daily cron job to categorize uncategorized expenses
 *
 * Runs daily at 2 AM (configure in Convex dashboard or convex.json)
 * Processes slowly to avoid rate limits: 4 second delay = 15 requests/min
 */
export const dailyCategorization = internalAction({
	args: {},
	handler: async (ctx) => {
		const startTime = Date.now()

		// Find uncategorized expenses
		const result = await ctx.runQuery((internal as any).cronJobs.findUncategorizedExpenses, {})

		if (result.totalUncategorized === 0) {
			return {
				uncategorized: 0,
				processed: 0,
				categorized: 0,
				queued: 0,
				duration: Date.now() - startTime,
			}
		}

		let categorizedCount = 0
		let queuedCount = 0

		// Process each merchant group
		for (const group of result.merchantGroups) {
			// Try heuristic categorization first
			const heuristicCategory = categorizeByHeuristics(
				group.merchantName,
				group.expenses[0].name,
			)

			if (heuristicCategory) {
				// Heuristic worked! Categorize all expenses from this merchant
				for (const expense of group.expenses) {
					await ctx.runMutation(internal.categorization.updateExpenseCategory, {
						expenseId: expense.expenseId,
						category: heuristicCategory,
						merchantName: group.merchantName,
					})
					categorizedCount++
				}
			} else {
				// Heuristic failed, queue for AI categorization
				// Only queue one job per merchant (will update all expenses from that merchant)
				for (const expense of group.expenses) {
					await ctx.runMutation(internal.jobQueue.createJob, {
						expenseId: expense.expenseId,
						merchantName: group.merchantName,
						description: expense.name,
					})
					queuedCount++
				}
			}
		}

		return {
			uncategorized: result.totalUncategorized,
			processed: result.merchantGroups.length,
			categorized: categorizedCount,
			queued: queuedCount,
			duration: Date.now() - startTime,
		}
	},
})

/**
 * Daily cleanup job
 *
 * Runs daily to clean up old completed jobs
 * Removes completed jobs older than 7 days
 */
export const dailyCleanup = internalAction({
	args: {},
	handler: async (ctx) => {
		const startTime = Date.now()

		// Clean up completed jobs
		const jobCleanup = await ctx.runMutation(
			(internal as any).jobQueue.cleanupCompletedJobs,
			{},
		)

		return {
			deletedJobs: jobCleanup.deleted,
			duration: Date.now() - startTime,
		}
	},
})

/**
 * Internal query to get all expenses with their categories
 */
export const getAllExpensesForStats = internalQuery({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("expenses").collect()
	},
})

/**
 * Weekly statistics report
 *
 * Runs weekly to generate statistics about categorization performance
 * Useful for monitoring and optimization
 */
export const weeklyStats = internalAction({
	args: {},
	handler: async (ctx) => {
		const startTime = Date.now()

		// Get all expenses
		const allExpenses = await ctx.runQuery((internal as any).cronJobs.getAllExpensesForStats, {})

		// Calculate statistics
		const totalExpenses = allExpenses.length
		const categorizedExpenses = allExpenses.filter((e: any) => e.category).length
		const uncategorizedExpenses = totalExpenses - categorizedExpenses

		// Category breakdown
		const categoryBreakdown = new Map<string, number>()
		for (const expense of allExpenses) {
			if (expense.category) {
				const count = categoryBreakdown.get(expense.category) || 0
				categoryBreakdown.set(expense.category, count + 1)
			}
		}

		// Job queue stats
		const jobStats = await ctx.runQuery((internal as any).jobQueue.getJobStats, {})

		// Rate limit stats
		const rateLimitStats = await ctx.runQuery(
			(internal as any).rateLimit.getAllRateLimitStatus,
			{},
		)

		return {
			timestamp: Date.now(),
			duration: Date.now() - startTime,
			expenses: {
				total: totalExpenses,
				categorized: categorizedExpenses,
				uncategorized: uncategorizedExpenses,
				categorizationRate:
					totalExpenses > 0
						? ((categorizedExpenses / totalExpenses) * 100).toFixed(2) + "%"
						: "0%",
			},
			categories: Object.fromEntries(categoryBreakdown),
			topCategories: Array.from(categoryBreakdown.entries())
				.sort((a, b) => b[1] - a[1])
				.slice(0, 5)
				.map(([category, count]) => ({ category, count })),
			jobQueue: jobStats,
			rateLimit: rateLimitStats,
		}
	},
})
