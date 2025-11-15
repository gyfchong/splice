import { action, internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { internal } from "./_generated/api"

const CATEGORIES = [
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
]

/**
 * Categorizes a merchant using OpenRouter + Groq
 * This is an action because it makes external API calls
 */
export const categorizeMerchantWithAI = action({
	args: {
		merchantName: v.string(),
		description: v.string(),
	},
	handler: async (ctx, { merchantName, description }): Promise<string> => {
		const apiKey = process.env.OPENROUTER_API_KEY

		if (!apiKey) {
			console.warn("OPENROUTER_API_KEY not set, defaulting to 'Other' category")
			return "Other"
		}

		try {
			const prompt = `You are an expense categorization assistant. Categorize the following merchant/transaction into ONE of these categories:

${CATEGORIES.join(", ")}

Merchant: ${merchantName}
Transaction description: ${description}

Respond with ONLY the category name, nothing else. Choose the most appropriate category.`

			const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
					"HTTP-Referer": "https://splice-app.netlify.app", // Optional but recommended
					"X-Title": "Splice Expense Tracker", // Optional but recommended
				},
				body: JSON.stringify({
					model: "meta-llama/llama-3.2-3b-instruct:free", // Free Groq model via OpenRouter
					messages: [
						{
							role: "user",
							content: prompt,
						},
					],
					temperature: 0.3, // Low temperature for consistent categorization
					max_tokens: 20, // We only need one word
				}),
			})

			if (!response.ok) {
				const errorText = await response.text()
				console.error("OpenRouter API error:", response.status, errorText)
				return "Other"
			}

			const data = await response.json()
			const category = data.choices[0]?.message?.content?.trim() || "Other"

			// Validate that the response is a valid category
			if (CATEGORIES.includes(category)) {
				return category
			}

			// If AI returned something unexpected, try to find a match
			for (const validCategory of CATEGORIES) {
				if (category.toLowerCase().includes(validCategory.toLowerCase())) {
					return validCategory
				}
			}

			console.warn(`AI returned invalid category: ${category}, defaulting to 'Other'`)
			return "Other"
		} catch (error) {
			console.error("Error categorizing with AI:", error)
			return "Other"
		}
	},
})

/**
 * Get global merchant mapping
 */
export const getGlobalMapping = query({
	args: { merchantName: v.string() },
	handler: async (ctx, { merchantName }) => {
		return await ctx.db
			.query("merchantMappings")
			.withIndex("by_merchant", (q) => q.eq("merchantName", merchantName))
			.first()
	},
})

/**
 * Get personal merchant mapping for a user
 */
export const getPersonalMapping = query({
	args: {
		userId: v.string(),
		merchantName: v.string(),
	},
	handler: async (ctx, { userId, merchantName }) => {
		return await ctx.db
			.query("personalMappings")
			.withIndex("by_user_merchant", (q) =>
				q.eq("userId", userId).eq("merchantName", merchantName),
			)
			.first()
	},
})

/**
 * Create or update global merchant mapping
 */
export const upsertGlobalMapping = internalMutation({
	args: {
		merchantName: v.string(),
		category: v.string(),
		confidence: v.string(),
		aiSuggestion: v.optional(v.string()),
	},
	handler: async (ctx, { merchantName, category, confidence, aiSuggestion }) => {
		const existing = await ctx.db
			.query("merchantMappings")
			.withIndex("by_merchant", (q) => q.eq("merchantName", merchantName))
			.first()

		if (existing) {
			// Update existing mapping
			await ctx.db.patch(existing._id, {
				category,
				confidence,
				lastUpdated: Date.now(),
			})
			return existing._id
		}

		// Create new mapping
		return await ctx.db.insert("merchantMappings", {
			merchantName,
			category,
			confidence,
			voteCount: confidence === "ai" ? 0 : 1,
			aiSuggestion,
			lastUpdated: Date.now(),
		})
	},
})

/**
 * Create or update personal merchant mapping
 */
export const upsertPersonalMapping = internalMutation({
	args: {
		userId: v.string(),
		merchantName: v.string(),
		category: v.string(),
	},
	handler: async (ctx, { userId, merchantName, category }) => {
		const existing = await ctx.db
			.query("personalMappings")
			.withIndex("by_user_merchant", (q) =>
				q.eq("userId", userId).eq("merchantName", merchantName),
			)
			.first()

		if (existing) {
			// Update existing mapping
			await ctx.db.patch(existing._id, {
				category,
			})
			return existing._id
		}

		// Create new mapping
		return await ctx.db.insert("personalMappings", {
			userId,
			merchantName,
			category,
			createdAt: Date.now(),
		})
	},
})

/**
 * Vote for a category on global mapping (for consensus building)
 */
export const voteForCategory = internalMutation({
	args: {
		merchantName: v.string(),
		category: v.string(),
	},
	handler: async (ctx, { merchantName, category }) => {
		const mapping = await ctx.db
			.query("merchantMappings")
			.withIndex("by_merchant", (q) => q.eq("merchantName", merchantName))
			.first()

		if (!mapping) {
			// Create new mapping if it doesn't exist
			await ctx.db.insert("merchantMappings", {
				merchantName,
				category,
				confidence: "user",
				voteCount: 1,
				lastUpdated: Date.now(),
			})
			return
		}

		// Increment vote count and potentially update category
		await ctx.db.patch(mapping._id, {
			voteCount: mapping.voteCount + 1,
			category, // Update to latest user choice (simple approach)
			confidence: "user",
			lastUpdated: Date.now(),
		})
	},
})

/**
 * Main categorization flow
 * 1. Check personal mapping
 * 2. Check global mapping
 * 3. Use AI if no mapping exists
 * 4. Store result in global mapping
 */
export const getCategoryForMerchant = action({
	args: {
		merchantName: v.string(),
		description: v.string(),
		userId: v.optional(v.string()),
	},
	handler: async (ctx, { merchantName, description, userId }): Promise<string> => {
		// 1. Check personal mapping first (highest priority)
		if (userId) {
			const personal = await ctx.runQuery(getPersonalMapping, { userId, merchantName })
			if (personal) {
				return personal.category
			}
		}

		// 2. Check global mapping
		const global = await ctx.runQuery(getGlobalMapping, { merchantName })
		if (global) {
			return global.category
		}

		// 3. Use AI to categorize
		const category = await categorizeMerchantWithAI({ merchantName, description })

		// 4. Store in global mapping for future use
		await ctx.runMutation(upsertGlobalMapping, {
			merchantName,
			category,
			confidence: "ai",
			aiSuggestion: category,
		})

		return category
	},
})

/**
 * Update expense category with user override
 * This handles the full flow:
 * 1. Update the expense
 * 2. Create/update personal mapping (if userId provided)
 * 3. Vote on global mapping
 */
export const updateExpenseCategoryWithMapping = action({
	args: {
		expenseId: v.string(),
		merchantName: v.string(),
		category: v.string(),
		userId: v.optional(v.string()),
		updateAllFromMerchant: v.optional(v.boolean()), // If true, create personal override
	},
	handler: async (ctx, args) => {
		// 1. Update the expense category
		await ctx.runMutation(internal.expenses.updateExpenseCategory, {
			expenseId: args.expenseId,
			category: args.category,
		})

		// 2. If user wants this to apply to all future transactions from this merchant
		if (args.updateAllFromMerchant && args.userId) {
			await ctx.runMutation(upsertPersonalMapping, {
				userId: args.userId,
				merchantName: args.merchantName,
				category: args.category,
			})
		}

		// 3. Vote on global mapping (helps crowd-sourcing)
		await ctx.runMutation(voteForCategory, {
			merchantName: args.merchantName,
			category: args.category,
		})

		return { success: true }
	},
})
