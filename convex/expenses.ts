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
