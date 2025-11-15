import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

// Get all years that have expenses
export const getYears = query({
	args: {},
	handler: async (ctx) => {
		const expenses = await ctx.db.query("expenses").collect()
		const years = [...new Set(expenses.map((e) => e.year))].sort((a, b) => b - a)
		return years
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

				// Calculate total share (split expenses / 2, unsplit expenses full amount)
				// Default to split (true) if undefined for backward compatibility
				const totalShare = sortedExpenses
					.filter((e) => e.checked)
					.reduce((sum, e) => sum + ((e.split ?? true) ? e.amount / 2 : e.amount), 0)

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
					checked: false,
					split: true, // Default to split (50/50)
					uploadTimestamp: Date.now(),
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

			// Calculate amount shared (split expenses / 2, unsplit expenses full amount)
			// Default to split (true) if undefined for backward compatibility
			const amountShared = monthExpenses
				.filter((e) => e.checked)
				.reduce((sum, e) => sum + ((e.split ?? true) ? e.amount / 2 : e.amount), 0)

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
		// Default to split (true) if undefined for backward compatibility
		const previousYearTotal = previousYearExpenses
			.filter((e) => e.checked)
			.reduce((sum, e) => sum + ((e.split ?? true) ? e.amount / 2 : e.amount), 0)

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

		// Calculate total share (split expenses / 2, unsplit expenses full amount)
		// Default to split (true) if undefined for backward compatibility
		const totalShare = sortedExpenses
			.filter((e) => e.checked)
			.reduce((sum, e) => sum + ((e.split ?? true) ? e.amount / 2 : e.amount), 0)

		return {
			year: args.year,
			month: args.month,
			expenses: sortedExpenses,
			totalShare: Math.round(totalShare * 100) / 100,
		}
	},
})
