import { action, internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { api, internal } from "./_generated/api"

// Get all years that have expenses
export const getYears = query({
	args: {},
	handler: async (ctx) => {
		const expenses = await ctx.db.query("expenses").collect()
		const years = [...new Set(expenses.map((e) => e.year))].sort((a, b) => b - a)
		return years
	},
})

// Get all expenses (for scanning and building mappings)
export const getAllExpenses = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("expenses").collect()
	},
})

// Get expenses grouped by month for a specific year
export const getExpensesByYear = query({
	args: { year: v.number() },
	handler: async (ctx, args) => {
		const expenses = await ctx.db
			.query("expenses")
			.filter((q) => q.eq(q.field("year"), args.year))
			.collect()

		// Group by month
		const monthsMap = new Map<string, typeof expenses>()
		for (const expense of expenses) {
			if (!monthsMap.has(expense.month)) {
				monthsMap.set(expense.month, [])
			}
			monthsMap.get(expense.month)!.push(expense)
		}

		// Sort months and expenses, calculate totals
		const months = Array.from(monthsMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([month, monthExpenses]) => {
				// Sort expenses by date
				const sortedExpenses = monthExpenses.sort((a, b) =>
					a.date.localeCompare(b.date),
				)

				// Calculate total share (sum of checked expenses / 2)
				const totalShare =
					sortedExpenses
						.filter((e) => e.checked)
						.reduce((sum, e) => sum + e.amount, 0) / 2

				return {
					month,
					expenses: sortedExpenses,
					totalShare,
				}
			})

		return { year: args.year, months }
	},
})

// Toggle expense checked status
export const toggleExpense = mutation({
	args: {
		expenseId: v.string(),
	},
	handler: async (ctx, args) => {
		const expense = await ctx.db
			.query("expenses")
			.withIndex("by_expense_id", (q) => q.eq("expenseId", args.expenseId))
			.first()

		if (!expense) {
			throw new Error("Expense not found")
		}

		await ctx.db.patch(expense._id, {
			checked: !expense.checked,
		})

		return {
			expenseId: args.expenseId,
			newCheckedStatus: !expense.checked,
			result: "success" as const,
		}
	},
})

// Toggle all expenses in a month
export const toggleAllExpenses = mutation({
	args: {
		year: v.number(),
		month: v.string(),
		checked: v.boolean(),
	},
	handler: async (ctx, args) => {
		const expenses = await ctx.db
			.query("expenses")
			.filter((q) => q.eq(q.field("year"), args.year))
			.filter((q) => q.eq(q.field("month"), args.month))
			.collect()

		for (const expense of expenses) {
			await ctx.db.patch(expense._id, {
				checked: args.checked,
			})
		}

		return {
			updatedCount: expenses.length,
			checked: args.checked,
			result: "success" as const,
		}
	},
})

// Toggle expense split status
export const toggleSplit = mutation({
	args: {
		expenseId: v.string(),
	},
	handler: async (ctx, args) => {
		const expense = await ctx.db
			.query("expenses")
			.withIndex("by_expense_id", (q) => q.eq("expenseId", args.expenseId))
			.first()

		if (!expense) {
			throw new Error("Expense not found")
		}

		// Default to true (split) if undefined for backward compatibility
		const currentSplit = expense.split ?? true
		const newSplit = !currentSplit

		await ctx.db.patch(expense._id, {
			split: newSplit,
		})

		return {
			expenseId: args.expenseId,
			newSplitStatus: newSplit,
			result: "success" as const,
		}
	},
})

// Add new expenses (with deduplication)
export const addExpenses = mutation({
	args: {
		expenses: v.array(
			v.object({
				expenseId: v.string(),
				name: v.string(),
				amount: v.number(),
				date: v.string(),
				year: v.number(),
				month: v.string(),
				checked: v.optional(v.boolean()), // Optional, for CSV imports that are pre-verified
				split: v.optional(v.boolean()), // Optional, whether expense is split (50/50) or not (100%)
				category: v.optional(v.string()), // Optional category
				merchantName: v.optional(v.string()), // Optional normalized merchant name
			}),
		),
	},
	handler: async (ctx, args) => {
		const newExpenseIds: string[] = []
		const duplicateCount = { count: 0 }

		for (const expense of args.expenses) {
			// Check if expense already exists
			const existing = await ctx.db
				.query("expenses")
				.withIndex("by_expense_id", (q) => q.eq("expenseId", expense.expenseId))
				.first()

			if (!existing) {
				await ctx.db.insert("expenses", {
					...expense,
					checked: expense.checked ?? false, // Use provided value or default to false
					split: expense.split ?? true, // Use provided value or default to split (50/50)
					uploadTimestamp: Date.now(),
					category: expense.category,
					merchantName: expense.merchantName,
				})
				newExpenseIds.push(expense.expenseId)
			} else {
				duplicateCount.count++
			}
		}

		return {
			addedCount: newExpenseIds.length,
			duplicateCount: duplicateCount.count,
			newExpenseIds,
		}
	},
})

// Record upload metadata
export const recordUpload = mutation({
	args: {
		filename: v.string(),
		size: v.number(),
		status: v.string(),
		errorMessage: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("uploads", {
			...args,
			uploadDate: Date.now(),
		})
	},
})

// Get upload history
export const getUploads = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db.query("uploads").order("desc").take(50)
	},
})

// Get year summary with monthly aggregates (all 12 months)
export const getYearSummary = query({
	args: {
		year: v.number(),
		sessionStartTime: v.optional(v.number()), // For tracking unseen expenses
	},
	handler: async (ctx, args) => {
		const expenses = await ctx.db
			.query("expenses")
			.filter((q) => q.eq(q.field("year"), args.year))
			.collect()

		// Get previous year data for comparison
		const previousYearExpenses = await ctx.db
			.query("expenses")
			.filter((q) => q.eq(q.field("year"), args.year - 1))
			.collect()

		// Create all 12 months with data
		const monthNames = [
			"January",
			"February",
			"March",
			"April",
			"May",
			"June",
			"July",
			"August",
			"September",
			"October",
			"November",
			"December",
		]

		const months = monthNames.map((monthName, index) => {
			const monthNum = (index + 1).toString().padStart(2, "0")
			const monthExpenses = expenses.filter((e) => e.month === monthNum)

			// Calculate amount shared (checked expenses / 2)
			const amountShared =
				monthExpenses
					.filter((e) => e.checked)
					.reduce((sum, e) => sum + e.amount, 0) / 2

			// Check if there are unseen expenses
			const hasUnseen = args.sessionStartTime
				? monthExpenses.some(
						(e) =>
							e.uploadTimestamp &&
							e.uploadTimestamp > (args.sessionStartTime ?? 0),
					)
				: false

			return {
				month: monthName,
				monthNumber: monthNum,
				amountShared: Math.round(amountShared * 100) / 100,
				numberOfExpenses: monthExpenses.length,
				showGreenDot: hasUnseen,
			}
		})

		// Calculate yearly totals
		const totalShared = months.reduce((sum, m) => sum + m.amountShared, 0)
		const averagePerMonth = Math.round((totalShared / 12) * 100) / 100

		// Calculate previous year total for comparison
		const previousYearTotal =
			previousYearExpenses
				.filter((e) => e.checked)
				.reduce((sum, e) => sum + e.amount, 0) / 2

		let changeComparedToPreviousYear:
			| { direction: string; icon: string; color: string }
			| undefined
		if (previousYearTotal > 0) {
			if (totalShared > previousYearTotal) {
				changeComparedToPreviousYear = {
					direction: "increase",
					icon: "up",
					color: "green",
				}
			} else if (totalShared < previousYearTotal) {
				changeComparedToPreviousYear = {
					direction: "decrease",
					icon: "down",
					color: "red",
				}
			} else {
				changeComparedToPreviousYear = {
					direction: "none",
					icon: "neutral",
					color: "gray",
				}
			}
		} else {
			changeComparedToPreviousYear = {
				direction: "none",
				icon: "neutral",
				color: "gray",
			}
		}

		return {
			year: args.year,
			totalShared: Math.round(totalShared * 100) / 100,
			averagePerMonth,
			changeComparedToPreviousYear,
			months,
			error: null,
		}
	},
})

// Get expenses for a specific month
export const getMonthExpenses = query({
	args: {
		year: v.number(),
		month: v.string(), // 2-digit format: "01", "02", etc.
	},
	handler: async (ctx, args) => {
		const expenses = await ctx.db
			.query("expenses")
			.filter((q) => q.eq(q.field("year"), args.year))
			.filter((q) => q.eq(q.field("month"), args.month))
			.collect()

		// Sort by date
		const sortedExpenses = expenses.sort((a, b) => a.date.localeCompare(b.date))

		// Calculate total share
		const totalShare =
			sortedExpenses
				.filter((e) => e.checked)
				.reduce((sum, e) => sum + e.amount, 0) / 2

		return {
			year: args.year,
			month: args.month,
			expenses: sortedExpenses,
			totalShare: Math.round(totalShare * 100) / 100,
		}
	},
})

// Get monthly expense totals across all time for charting
export const getMonthlyTotals = query({
	args: {},
	handler: async (ctx) => {
		const expenses = await ctx.db.query("expenses").collect()

		// Group by year-month
		const monthlyMap = new Map<
			string,
			{ year: number; month: string; total: number }
		>()

		for (const expense of expenses) {
			if (!expense.checked) continue // Only count checked expenses

			const key = `${expense.year}-${expense.month}`
			const existing = monthlyMap.get(key) || {
				year: expense.year,
				month: expense.month,
				total: 0,
			}

			// Add to total, dividing by 2 for split expenses (default is split)
			const isSplit = expense.split ?? true
			const shareAmount = isSplit ? expense.amount / 2 : expense.amount
			existing.total += shareAmount

			monthlyMap.set(key, existing)
		}

		// Convert to array and sort by date
		const monthlyData = Array.from(monthlyMap.values())
			.sort((a, b) => {
				if (a.year !== b.year) return a.year - b.year
				return a.month.localeCompare(b.month)
			})
			.map((item) => ({
				...item,
				total: Math.round(item.total * 100) / 100,
				// Format label as "Jan 2024"
				label: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number.parseInt(item.month) - 1]} ${item.year}`,
			}))

		return monthlyData
	},
})

// Update expense category
export const updateExpenseCategory = internalMutation({
	args: {
		expenseId: v.string(),
		category: v.string(),
	},
	handler: async (ctx, args) => {
		const expense = await ctx.db
			.query("expenses")
			.withIndex("by_expense_id", (q) => q.eq("expenseId", args.expenseId))
			.first()

		if (!expense) {
			throw new Error("Expense not found")
		}

		await ctx.db.patch(expense._id, {
			category: args.category,
		})

		return {
			expenseId: args.expenseId,
			category: args.category,
			result: "success" as const,
		}
	},
})

// Internal mutation to update expense with category and merchant
export const updateExpenseWithCategoryAndMerchant = internalMutation({
	args: {
		expenseId: v.string(),
		category: v.string(),
		merchantName: v.string(),
	},
	handler: async (ctx, args) => {
		const expense = await ctx.db
			.query("expenses")
			.withIndex("by_expense_id", (q) => q.eq("expenseId", args.expenseId))
			.first()

		if (!expense) {
			throw new Error("Expense not found")
		}

		await ctx.db.patch(expense._id, {
			category: args.category,
			merchantName: args.merchantName,
		})
	},
})

/**
 * Add expenses with automatic categorization
 * This action:
 * 1. Takes parsed expenses from PDF/CSV
 * 2. Saves ALL expenses to database first (graceful degradation)
 * 3. Normalizes merchant names
 * 4. Deduplicates merchants to reduce API calls
 * 5. Categorizes each UNIQUE merchant using AI or cached mappings (with delays)
 * 6. Updates expenses with categories
 *
 * PHASE 1 IMPROVEMENTS:
 * - Saves expenses first to prevent data loss
 * - Batch deduplication (one API call per unique merchant)
 * - 4-second delays between AI calls to respect rate limits (15 req/min)
 * - Graceful error handling - continues on rate limit errors
 */
export const addExpensesWithCategories = action({
	args: {
		expenses: v.array(
			v.object({
				expenseId: v.string(),
				name: v.string(),
				amount: v.number(),
				date: v.string(),
				year: v.number(),
				month: v.string(),
				checked: v.optional(v.boolean()),
				split: v.optional(v.boolean()), // Whether expense is split (50/50) or not (100%)
			}),
		),
		userId: v.optional(v.string()),
		delayMs: v.optional(v.number()), // Delay between AI calls (default: 4000ms)
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		addedCount: number
		duplicateCount: number
		newExpenseIds: string[]
		categorizedCount: number
		failedMerchants: string[]
		totalMerchants: number
	}> => {
		const { normalizeMerchant } = await import("./utils")
		const delayMs = args.delayMs ?? 4000 // Default 4 seconds (15 req/min for 16/min limit)

		// STEP 1: Save ALL expenses immediately (without categories)
		// This ensures data is never lost, even if categorization fails
		console.log(`[addExpensesWithCategories] Saving ${args.expenses.length} expenses to database...`)

		const expensesWithMerchants = args.expenses.map((expense) => ({
			...expense,
			merchantName: normalizeMerchant(expense.name),
			category: undefined, // Will be filled in later
			split: expense.split ?? true, // Default to split (50/50) if not specified
		}))

		const saveResult = await ctx.runMutation(api.expenses.addExpenses, {
			expenses: expensesWithMerchants,
		})

		console.log(
			`[addExpensesWithCategories] Saved ${saveResult.addedCount} new expenses, ${saveResult.duplicateCount} duplicates`,
		)

		// STEP 2: Deduplicate merchants to minimize API calls
		// Group expenses by normalized merchant name
		const merchantGroups = new Map<
			string,
			Array<{
				expenseId: string
				name: string
				merchantName: string
			}>
		>()

		for (const expense of expensesWithMerchants) {
			if (!merchantGroups.has(expense.merchantName)) {
				merchantGroups.set(expense.merchantName, [])
			}
			merchantGroups.get(expense.merchantName)!.push({
				expenseId: expense.expenseId,
				name: expense.name,
				merchantName: expense.merchantName,
			})
		}

		console.log(
			`[addExpensesWithCategories] Deduplication: ${args.expenses.length} expenses → ${merchantGroups.size} unique merchants`,
		)

		// STEP 3: Categorize each UNIQUE merchant with delays and error handling
		let categorizedCount = 0
		const failedMerchants: string[] = []

		let merchantIndex = 0
		for (const [merchantName, expenses] of merchantGroups.entries()) {
			merchantIndex++

			try {
				console.log(
					`[addExpensesWithCategories] Categorizing merchant ${merchantIndex}/${merchantGroups.size}: ${merchantName} (${expenses.length} expenses)`,
				)

				// Get category for this merchant (checks cache first)
				const category = await ctx.runAction(
					api.categorization.getCategoryForMerchant,
					{
						merchantName,
						description: expenses[0].name,
						userId: args.userId,
					},
				)

				// Update ALL expenses from this merchant with the category
				for (const expense of expenses) {
					try {
						await ctx.runMutation(internal.expenses.updateExpenseCategory, {
							expenseId: expense.expenseId,
							category,
						})
						categorizedCount++
					} catch (updateError) {
						console.error(
							`[addExpensesWithCategories] Failed to update expense ${expense.expenseId}:`,
							updateError,
						)
					}
				}

				console.log(
					`[addExpensesWithCategories] ✓ Categorized ${merchantName} as "${category}" (${expenses.length} expenses)`,
				)

				// CRITICAL: Add delay between AI calls to respect rate limits
				// 4 seconds = 15 req/min (safely under 16 req/min limit)
				if (merchantIndex < merchantGroups.size && delayMs > 0) {
					console.log(`[addExpensesWithCategories] Waiting ${delayMs}ms before next API call...`)
					await new Promise((resolve) => setTimeout(resolve, delayMs))
				}
			} catch (error) {
				const errorMessage = (error as Error).message || String(error)
				console.error(`[addExpensesWithCategories] Error categorizing merchant ${merchantName}:`, error)

				// Check if this is a rate limit error
				if (errorMessage.includes("RATE_LIMIT")) {
					console.warn(
						`[addExpensesWithCategories] ⚠ Rate limit hit for ${merchantName}. Continuing with remaining merchants...`,
					)
					failedMerchants.push(merchantName)

					// Add longer delay after rate limit error
					if (merchantIndex < merchantGroups.size) {
						const backoffDelay = delayMs * 2 // Double the delay
						console.log(`[addExpensesWithCategories] Waiting ${backoffDelay}ms after rate limit...`)
						await new Promise((resolve) => setTimeout(resolve, backoffDelay))
					}
				} else {
					// Non-rate-limit error - still continue but log it
					console.error(`[addExpensesWithCategories] Non-rate-limit error for ${merchantName}:`, errorMessage)
					failedMerchants.push(merchantName)
				}

				// Continue with next merchant instead of failing entire upload
			}
		}

		const successRate = Math.round((categorizedCount / args.expenses.length) * 100)
		console.log(
			`[addExpensesWithCategories] Categorization complete: ${categorizedCount}/${args.expenses.length} expenses (${successRate}%)`,
		)

		if (failedMerchants.length > 0) {
			console.warn(`[addExpensesWithCategories] Failed merchants (${failedMerchants.length}):`, failedMerchants)
		}

		return {
			addedCount: saveResult.addedCount,
			duplicateCount: saveResult.duplicateCount,
			newExpenseIds: saveResult.newExpenseIds,
			categorizedCount,
			failedMerchants,
			totalMerchants: merchantGroups.size,
		}
	},
})
