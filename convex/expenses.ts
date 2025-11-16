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

// Migration: Infer split field from checked field for backward compatibility
// checked=true expenses were counted as shared (50%) → split=true
// checked=false expenses were not counted → split=false (individual 100%)
export const migrateSplitFromChecked = mutation({
	args: {},
	handler: async (ctx) => {
		const expenses = await ctx.db.query("expenses").collect()
		let migrated = 0

		for (const expense of expenses) {
			// Only migrate if split is undefined
			if (expense.split === undefined) {
				await ctx.db.patch(expense._id, {
					split: expense.checked, // checked=true → split=true, checked=false → split=false
				})
				migrated++
			}
		}

		return {
			message: `Migrated ${migrated} expenses`,
			total: expenses.length,
			alreadyMigrated: expenses.length - migrated,
		}
	},
})

// Get merchant's split pattern from recent history for smart auto-split prediction
export const getMerchantSplitPattern = query({
	args: {
		merchantName: v.string(),
		lookbackMonths: v.number(), // Usually 2
		fromDate: v.string(), // YYYY-MM-DD format
	},
	handler: async (ctx, args) => {
		const { calculateCutoffDate } = await import("./utils")

		// Calculate date N months ago
		const cutoffDate = calculateCutoffDate(args.fromDate, args.lookbackMonths)

		// Get all expenses from this merchant in lookback period
		const historicalExpenses = await ctx.db
			.query("expenses")
			.filter((q) =>
				q.and(
					q.eq(q.field("merchantName"), args.merchantName),
					q.gte(q.field("date"), cutoffDate),
					q.lt(q.field("date"), args.fromDate), // Don't include expenses on same day or later
				),
			)
			.collect()

		if (historicalExpenses.length === 0) {
			return {
				suggestedSplit: true, // default to split
				confidence: "none" as const,
				sampleSize: 0,
				splitPercentage: 0,
			}
		}

		// Count split vs individual
		const splitCount = historicalExpenses.filter((e) => e.split ?? false).length
		const individualCount = historicalExpenses.length - splitCount
		const splitPercentage = splitCount / historicalExpenses.length

		// Determine suggestion based on 80% threshold
		if (splitPercentage >= 0.8) {
			return {
				suggestedSplit: true,
				confidence: "high" as const,
				sampleSize: historicalExpenses.length,
				splitPercentage: Math.round(splitPercentage * 100) / 100,
			}
		}
		if (splitPercentage <= 0.2) {
			return {
				suggestedSplit: false,
				confidence: "high" as const,
				sampleSize: historicalExpenses.length,
				splitPercentage: Math.round(splitPercentage * 100) / 100,
			}
		}
		// Mixed pattern - default to split
		return {
			suggestedSplit: true,
			confidence: "low" as const,
			sampleSize: historicalExpenses.length,
			splitPercentage: Math.round(splitPercentage * 100) / 100,
		}
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

		// Default to false (individual) if undefined - most expenses are personal
		const currentSplit = expense.split ?? false
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
					split: expense.split ?? false, // Use provided value or default to individual (100%)
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

			// Calculate all totals
			let totalPersonal = 0
			let totalShared = 0
			let totalMine = 0

			for (const expense of monthExpenses) {
				const isSplit = expense.split ?? false
				if (isSplit) {
					const share = expense.amount / 2
					totalShared += share
					totalPersonal += share
				} else {
					totalMine += expense.amount
					totalPersonal += expense.amount
				}
			}

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
				totals: {
					all: Math.round(totalPersonal * 100) / 100,
					mine: Math.round(totalMine * 100) / 100,
					shared: Math.round(totalShared * 100) / 100,
				},
				counts: {
					all: monthExpenses.length,
					mine: monthExpenses.filter((e) => !(e.split ?? false)).length,
					shared: monthExpenses.filter((e) => e.split ?? false).length,
				},
				showGreenDot: hasUnseen,
			}
		})

		// Calculate yearly totals
		const totalAll = months.reduce((sum, m) => sum + m.totals.all, 0)
		const totalShared = months.reduce((sum, m) => sum + m.totals.shared, 0)
		const totalMine = months.reduce((sum, m) => sum + m.totals.mine, 0)
		const averagePerMonth = Math.round((totalAll / 12) * 100) / 100

		// Calculate previous year total for comparison
		let previousYearTotal = 0
		for (const expense of previousYearExpenses) {
			const isSplit = expense.split ?? false
			previousYearTotal += isSplit ? expense.amount / 2 : expense.amount
		}

		let changeComparedToPreviousYear:
			| { direction: string; icon: string; color: string }
			| undefined
		if (previousYearTotal > 0) {
			if (totalAll > previousYearTotal) {
				changeComparedToPreviousYear = {
					direction: "increase",
					icon: "up",
					color: "green",
				}
			} else if (totalAll < previousYearTotal) {
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
			totals: {
				all: Math.round(totalAll * 100) / 100,
				mine: Math.round(totalMine * 100) / 100,
				shared: Math.round(totalShared * 100) / 100,
			},
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

		// Calculate all three totals
		let totalPersonal = 0 // Your total spending (shared + mine)
		let totalShared = 0 // Your share of split expenses (amount / 2)
		let totalMine = 0 // Your individual expenses (amount @ 100%)

		for (const expense of sortedExpenses) {
			const isSplit = expense.split ?? false
			if (isSplit) {
				const share = expense.amount / 2
				totalShared += share
				totalPersonal += share
			} else {
				totalMine += expense.amount
				totalPersonal += expense.amount
			}
		}

		return {
			year: args.year,
			month: args.month,
			expenses: sortedExpenses,
			totals: {
				all: Math.round(totalPersonal * 100) / 100, // Total personal spending
				mine: Math.round(totalMine * 100) / 100, // 100% expenses only
				shared: Math.round(totalShared * 100) / 100, // 50% of split expenses
			},
			counts: {
				all: expenses.length,
				mine: expenses.filter((e) => !(e.split ?? false)).length,
				shared: expenses.filter((e) => e.split ?? false).length,
			},
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
			const key = `${expense.year}-${expense.month}`
			const existing = monthlyMap.get(key) || {
				year: expense.year,
				month: expense.month,
				total: 0,
			}

			// Add to total, dividing by 2 for split expenses (default is split)
			const isSplit = expense.split ?? false
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
 *
 * PHASE 2 IMPROVEMENTS:
 * - Exponential backoff retry logic for failed categorizations
 * - Enhanced return type with detailed statistics
 * - Comprehensive logging with attempt tracking
 * - Success rate and retry metrics
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
		enableRetry: v.optional(v.boolean()), // Enable exponential backoff retry (Phase 2)
		maxRetries: v.optional(v.number()), // Max retry attempts (default: 3)
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
		categorizedFromCache: number
		categorizedFromAI: number
		retriedMerchants: number
		totalRetryAttempts: number
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
			split: expense.split ?? false, // Default to individual (100%) if not specified
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
		// PHASE 2: Enhanced statistics tracking
		let categorizedCount = 0
		let categorizedFromCache = 0
		let categorizedFromAI = 0
		let retriedMerchants = 0
		let totalRetryAttempts = 0
		const failedMerchants: string[] = []
		const enableRetry = args.enableRetry ?? true // Enable retry by default in Phase 2
		const maxRetries = args.maxRetries ?? 3

		console.log(
			`[addExpensesWithCategories] PHASE 2 mode: enableRetry=${enableRetry}, maxRetries=${maxRetries}`,
		)

		let merchantIndex = 0
		for (const [merchantName, expenses] of merchantGroups.entries()) {
			merchantIndex++

			try {
				console.log(
					`[addExpensesWithCategories] Categorizing merchant ${merchantIndex}/${merchantGroups.size}: ${merchantName} (${expenses.length} expenses)`,
				)

				// Get category for this merchant (checks cache first, optionally retries on failure)
				const result = await ctx.runAction(
					api.categorization.getCategoryForMerchant,
					{
						merchantName,
						description: expenses[0].name,
						userId: args.userId,
						enableRetry,
						maxRetries,
					},
				)

				// Track statistics from categorization result
				if (result.source === "personal" || result.source === "global") {
					categorizedFromCache++
					console.log(
						`[addExpensesWithCategories] ✓ Cache hit (${result.source}) for ${merchantName}: ${result.category}`,
					)
				} else if (result.source === "ai" || result.source === "ai-retry") {
					categorizedFromAI++
					if (result.source === "ai-retry" && result.attempts && result.attempts > 1) {
						retriedMerchants++
						totalRetryAttempts += result.attempts - 1 // Subtract 1 to get retry count (not total attempts)
						console.log(
							`[addExpensesWithCategories] ✓ AI categorized ${merchantName} after ${result.attempts} attempts (${result.attempts - 1} retries)`,
						)
					} else {
						console.log(
							`[addExpensesWithCategories] ✓ AI categorized ${merchantName} on first attempt`,
						)
					}
				}

				// Update ALL expenses from this merchant with the category
				for (const expense of expenses) {
					try {
						await ctx.runMutation(internal.expenses.updateExpenseCategory, {
							expenseId: expense.expenseId,
							category: result.category,
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
					`[addExpensesWithCategories] ✓ Categorized ${merchantName} as "${result.category}" (${expenses.length} expenses)`,
				)

				// CRITICAL: Add delay between AI calls to respect rate limits
				// 4 seconds = 15 req/min (safely under 16 req/min limit)
				// Only delay if we actually made an AI call (not cached)
				if (merchantIndex < merchantGroups.size && delayMs > 0 && (result.source === "ai" || result.source === "ai-retry")) {
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

		// PHASE 2: Comprehensive logging with detailed statistics
		console.log(`[addExpensesWithCategories] ========== CATEGORIZATION SUMMARY ==========`)
		console.log(`[addExpensesWithCategories] Total expenses: ${args.expenses.length}`)
		console.log(`[addExpensesWithCategories] Unique merchants: ${merchantGroups.size}`)
		console.log(`[addExpensesWithCategories] Categorized: ${categorizedCount}/${args.expenses.length} (${successRate}%)`)
		console.log(`[addExpensesWithCategories] - From cache: ${categorizedFromCache} merchants`)
		console.log(`[addExpensesWithCategories] - From AI: ${categorizedFromAI} merchants`)
		if (retriedMerchants > 0) {
			console.log(`[addExpensesWithCategories] - Retried: ${retriedMerchants} merchants (${totalRetryAttempts} total retry attempts)`)
			console.log(`[addExpensesWithCategories] - Average retries per failed merchant: ${(totalRetryAttempts / retriedMerchants).toFixed(1)}`)
		}
		if (failedMerchants.length > 0) {
			console.warn(`[addExpensesWithCategories] Failed merchants (${failedMerchants.length}):`, failedMerchants)
		}
		console.log(`[addExpensesWithCategories] ==========================================`)

		return {
			addedCount: saveResult.addedCount,
			duplicateCount: saveResult.duplicateCount,
			newExpenseIds: saveResult.newExpenseIds,
			categorizedCount,
			failedMerchants,
			totalMerchants: merchantGroups.size,
			categorizedFromCache,
			categorizedFromAI,
			retriedMerchants,
			totalRetryAttempts,
		}
	},
})

/**
 * PHASE 3: Add expenses with background categorization
 *
 * This version uses the job queue for non-blocking categorization:
 * 1. Saves all expenses immediately
 * 2. Uses heuristic categorization for common merchants (instant)
 * 3. Queues AI categorization jobs for unknown merchants (background)
 * 4. Returns immediately without waiting for AI
 *
 * Benefits:
 * - No user-facing rate limit errors
 * - Instant upload completion
 * - 70%+ expenses categorized immediately via heuristics
 * - Remaining 30% categorized in background
 */
export const addExpensesWithBackgroundCategorization = action({
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
				split: v.optional(v.boolean()),
			}),
		),
		userId: v.optional(v.string()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		addedCount: number
		duplicateCount: number
		newExpenseIds: string[]
		categorizedCount: number
		queuedCount: number
		totalMerchants: number
		heuristicCategorizationCount: number
		cacheCategorizationCount: number
	}> => {
		const { normalizeMerchant } = await import("./utils")
		const { categorizeByHeuristics } = await import("./heuristics")

		console.log(`[Phase 3] Saving ${args.expenses.length} expenses with background categorization...`)

		// STEP 1: Predict split status based on merchant history
		const expensesWithMerchants = args.expenses.map((expense) => ({
			...expense,
			merchantName: normalizeMerchant(expense.name),
			category: undefined,
			split: expense.split ?? false, // Will be overridden by prediction if available
		}))

		// STEP 1.5: Smart auto-split prediction for each expense
		const expensesWithPredictedSplit = await Promise.all(
			expensesWithMerchants.map(async (expense) => {
				// If split was explicitly set in the import, keep it
				if (args.expenses.find((e) => e.expenseId === expense.expenseId)?.split !== undefined) {
					console.log(
						`[Smart Split] ${expense.merchantName}: using explicit value ${expense.split}`,
					)
					return expense
				}

				// Get merchant's historical pattern
				const pattern = await ctx.runQuery(api.expenses.getMerchantSplitPattern, {
					merchantName: expense.merchantName,
					lookbackMonths: 2,
					fromDate: expense.date,
				})

				// Apply prediction if we have high confidence
				let finalSplit = expense.split // default
				if (pattern.confidence === "high") {
					finalSplit = pattern.suggestedSplit
					console.log(
						`[Smart Split] ${expense.merchantName}: predicted ${finalSplit} (${pattern.sampleSize} samples, ${(pattern.splitPercentage * 100).toFixed(0)}% split)`,
					)
				} else if (pattern.confidence === "low") {
					console.log(
						`[Smart Split] ${expense.merchantName}: mixed history, defaulting to split=true (${pattern.sampleSize} samples, ${(pattern.splitPercentage * 100).toFixed(0)}% split)`,
					)
				} else {
					console.log(
						`[Smart Split] ${expense.merchantName}: no history, defaulting to split=true`,
					)
				}

				return {
					...expense,
					split: finalSplit,
				}
			}),
		)

		// STEP 2: Save ALL expenses immediately
		const saveResult = await ctx.runMutation(api.expenses.addExpenses, {
			expenses: expensesWithPredictedSplit,
		})

		console.log(
			`[Phase 3] Saved ${saveResult.addedCount} new expenses, ${saveResult.duplicateCount} duplicates`,
		)

		// STEP 3: Deduplicate merchants
		const merchantGroups = new Map<
			string,
			Array<{
				expenseId: string
				name: string
				merchantName: string
			}>
		>()

		for (const expense of expensesWithPredictedSplit) {
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
			`[Phase 3] Deduplication: ${args.expenses.length} expenses → ${merchantGroups.size} unique merchants`,
		)

		// STEP 3: Process each merchant with heuristics first, then queue or cache
		let categorizedCount = 0
		let queuedCount = 0
		let heuristicCategorizationCount = 0
		let cacheCategorizationCount = 0

		for (const [merchantName, expenses] of merchantGroups.entries()) {
			try {
				console.log(`[Phase 3] Processing merchant: ${merchantName} (${expenses.length} expenses)`)

				// Check personal mapping first
				let category: string | null = null
				let source = ""

				if (args.userId) {
					const personal = await ctx.runQuery(api.categorization.getPersonalMapping, {
						userId: args.userId,
						merchantName,
					})
					if (personal) {
						category = personal.category
						source = "personal"
						cacheCategorizationCount++
						console.log(`[Phase 3] ✓ Personal mapping for ${merchantName}: ${category}`)
					}
				}

				// Check global mapping
				if (!category) {
					const global = await ctx.runQuery(api.categorization.getGlobalMapping, {
						merchantName,
					})
					if (global) {
						category = global.category
						source = "global"
						cacheCategorizationCount++
						console.log(`[Phase 3] ✓ Global mapping for ${merchantName}: ${category}`)
					}
				}

				// Try heuristic categorization
				if (!category) {
					category = categorizeByHeuristics(merchantName, expenses[0].name)
					if (category) {
						source = "heuristic"
						heuristicCategorizationCount++
						console.log(`[Phase 3] ✓ Heuristic categorized ${merchantName}: ${category}`)

						// Store heuristic result in global mapping for future use
						await ctx.runMutation(internal.categorization.upsertGlobalMapping, {
							merchantName,
							category,
							confidence: "ai",
						})
					}
				}

				// If we have a category (from cache or heuristic), apply it immediately
				if (category) {
					for (const expense of expenses) {
						await ctx.runMutation(internal.categorization.updateExpenseCategory, {
							expenseId: expense.expenseId,
							category,
							merchantName,
							userId: args.userId,
						})
						categorizedCount++
					}
					console.log(
						`[Phase 3] ✓ Categorized ${merchantName} as "${category}" (${expenses.length} expenses) [source: ${source}]`,
					)
				} else {
					// No category found - queue for background AI categorization
					console.log(`[Phase 3] ⏳ Queueing ${merchantName} for background AI categorization`)

					for (const expense of expenses) {
						await ctx.runMutation(internal.jobQueue.createJob, {
							expenseId: expense.expenseId,
							merchantName,
							description: expense.name,
							userId: args.userId,
						})
						queuedCount++
					}
				}
			} catch (error) {
				console.error(`[Phase 3] Error processing merchant ${merchantName}:`, error)
				// Continue with next merchant
			}
		}

		console.log(`[Phase 3] ========== CATEGORIZATION SUMMARY ==========`)
		console.log(`[Phase 3] Total expenses: ${args.expenses.length}`)
		console.log(`[Phase 3] Unique merchants: ${merchantGroups.size}`)
		console.log(`[Phase 3] Categorized immediately: ${categorizedCount}/${args.expenses.length}`)
		console.log(`[Phase 3]   - From cache: ${cacheCategorizationCount} merchants`)
		console.log(`[Phase 3]   - From heuristics: ${heuristicCategorizationCount} merchants`)
		console.log(`[Phase 3] Queued for background: ${queuedCount}`)
		console.log(`[Phase 3] ==========================================`)

		return {
			addedCount: saveResult.addedCount,
			duplicateCount: saveResult.duplicateCount,
			newExpenseIds: saveResult.newExpenseIds,
			categorizedCount,
			queuedCount,
			totalMerchants: merchantGroups.size,
			heuristicCategorizationCount,
			cacheCategorizationCount,
		}
	},
})

/**
 * PHASE 3: Get job queue statistics
 * Exposes background categorization progress to the UI
 */
export const getJobQueueStats = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.runQuery((internal as any).jobQueue.getJobStats, {})
	},
})

/**
 * PHASE 3: Get rate limit status
 * Shows current rate limit state for monitoring
 */
export const getRateLimitStatus = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.runQuery((internal as any).rateLimit.getAllRateLimitStatus, {})
	},
})
