import { action, internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { api, internal } from "./_generated/api"

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
 *
 * PHASE 1 IMPROVEMENTS:
 * - Better rate limit error handling with retry-after parsing
 * - Enhanced logging for debugging
 * - Graceful fallback to "Other" for non-critical errors
 */
export const categorizeMerchantWithAI = action({
	args: {
		merchantName: v.string(),
		description: v.string(),
	},
	handler: async (ctx, { merchantName, description }): Promise<string> => {
		const apiKey = process.env.OPENROUTER_API_KEY

		if (!apiKey) {
			console.warn("[categorizeMerchantWithAI] OPENROUTER_API_KEY not set, defaulting to 'Other' category")
			return "Other"
		}

		try {
			console.log(`[categorizeMerchantWithAI] Categorizing merchant: ${merchantName}`)

			const prompt = `You are an expense categorization assistant. Categorize the following merchant/transaction into ONE of these categories:

${CATEGORIES.join(", ")}

Merchant: ${merchantName}
Transaction description: ${description}

Respond with ONLY the category name, nothing else. Choose the most appropriate category.`

			const requestStart = Date.now()
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

			const requestDuration = Date.now() - requestStart
			console.log(`[categorizeMerchantWithAI] API request completed in ${requestDuration}ms (status: ${response.status})`)

			if (!response.ok) {
				const errorText = await response.text()
				console.error("[categorizeMerchantWithAI] OpenRouter API error:", response.status, errorText)

				// Handle rate limiting specially
				if (response.status === 429) {
					console.warn(`[categorizeMerchantWithAI] ⚠ Rate limit hit for merchant: ${merchantName}`)

					try {
						const errorData = JSON.parse(errorText)

						// Try to extract retry-after time from various possible locations
						const retryAfter =
							errorData.error?.metadata?.headers?.["retry-after"] ||
							errorData.error?.metadata?.headers?.["Retry-After"] ||
							errorData.error?.metadata?.headers?.["X-RateLimit-Reset"] ||
							null

						if (retryAfter) {
							console.log(`[categorizeMerchantWithAI] Rate limit reset time: ${retryAfter}`)
							throw new Error(`RATE_LIMIT:${retryAfter}`)
						}
					} catch (parseError) {
						// If we can't parse the reset time, throw generic rate limit error
						if ((parseError as Error).message?.startsWith("RATE_LIMIT:")) {
							throw parseError
						}
					}
					throw new Error("RATE_LIMIT")
				}

				// For other HTTP errors, log and return fallback
				console.warn(`[categorizeMerchantWithAI] HTTP ${response.status} error, using fallback category "Other"`)
				return "Other"
			}

			const data = await response.json()
			const category = data.choices[0]?.message?.content?.trim() || "Other"

			console.log(`[categorizeMerchantWithAI] ✓ AI categorized ${merchantName} as "${category}"`)

			// Validate that the response is a valid category
			if (CATEGORIES.includes(category)) {
				return category
			}

			// If AI returned something unexpected, try to find a match
			for (const validCategory of CATEGORIES) {
				if (category.toLowerCase().includes(validCategory.toLowerCase())) {
					console.log(`[categorizeMerchantWithAI] Fuzzy matched "${category}" → "${validCategory}"`)
					return validCategory
				}
			}

			console.warn(
				`[categorizeMerchantWithAI] AI returned invalid category: "${category}", defaulting to 'Other'`,
			)
			return "Other"
		} catch (error) {
			console.error("[categorizeMerchantWithAI] Error categorizing with AI:", error)
			// Re-throw rate limit errors so they can be handled upstream
			if ((error as Error).message?.startsWith("RATE_LIMIT")) {
				throw error
			}
			// For all other errors, fallback to "Other"
			console.warn(`[categorizeMerchantWithAI] Falling back to "Other" category for ${merchantName}`)
			return "Other"
		}
	},
})

/**
 * PHASE 2: Exponential backoff retry wrapper for AI categorization
 * Retries failed categorizations with increasing delays
 *
 * @param merchantName - Normalized merchant name
 * @param description - Transaction description
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Category name or "Other" as fallback
 */
export const categorizeMerchantWithRetry = action({
	args: {
		merchantName: v.string(),
		description: v.string(),
		maxRetries: v.optional(v.number()),
	},
	handler: async (ctx, { merchantName, description, maxRetries = 3 }): Promise<{
		category: string
		attempts: number
		finalAttemptSucceeded: boolean
		retryDelays: number[]
	}> => {
		let lastError: Error | null = null
		const retryDelays: number[] = []

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				console.log(
					`[categorizeMerchantWithRetry] Attempt ${attempt + 1}/${maxRetries} for ${merchantName}`,
				)

				const category = await ctx.runAction(api.categorization.categorizeMerchantWithAI, {
					merchantName,
					description,
				})

				console.log(
					`[categorizeMerchantWithRetry] ✓ Success on attempt ${attempt + 1} for ${merchantName}: ${category}`,
				)

				return {
					category,
					attempts: attempt + 1,
					finalAttemptSucceeded: true,
					retryDelays,
				}
			} catch (error) {
				lastError = error as Error
				const errorMessage = lastError.message || String(error)

				// Check if this is a rate limit error
				if (errorMessage.startsWith("RATE_LIMIT")) {
					console.warn(
						`[categorizeMerchantWithRetry] ⚠ Rate limit hit on attempt ${attempt + 1} for ${merchantName}`,
					)

					// If we have more retries left, wait with exponential backoff
					if (attempt < maxRetries - 1) {
						// Exponential backoff: 1s, 2s, 4s, 8s, etc. (max 30s)
						const delay = Math.min(1000 * 2 ** attempt, 30000)
						retryDelays.push(delay)
						console.log(
							`[categorizeMerchantWithRetry] Waiting ${delay}ms before retry ${attempt + 2}...`,
						)
						await new Promise((resolve) => setTimeout(resolve, delay))
						continue
					}

					// Max retries reached
					console.error(
						`[categorizeMerchantWithRetry] ✗ Max retries (${maxRetries}) reached for ${merchantName}, using fallback category "Other"`,
					)
					return {
						category: "Other",
						attempts: maxRetries,
						finalAttemptSucceeded: false,
						retryDelays,
					}
				}

				// Non-rate-limit error - fail immediately
				console.error(
					`[categorizeMerchantWithRetry] ✗ Non-rate-limit error for ${merchantName}:`,
					errorMessage,
				)
				throw error
			}
		}

		// Should not reach here, but fallback to "Other" if we do
		console.error(
			`[categorizeMerchantWithRetry] ✗ All retries exhausted for ${merchantName}, using fallback category "Other"`,
		)
		return {
			category: "Other",
			attempts: maxRetries,
			finalAttemptSucceeded: false,
			retryDelays,
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
 * Create global mapping with vote counts (for bulk operations)
 */
export const createGlobalMappingWithVotes = internalMutation({
	args: {
		merchantName: v.string(),
		category: v.string(),
		voteCount: v.number(),
		categoryVotes: v.optional(v.any()),
	},
	handler: async (ctx, { merchantName, category, voteCount, categoryVotes }) => {
		return await ctx.db.insert("merchantMappings", {
			merchantName,
			category,
			confidence: "consensus",
			voteCount,
			categoryVotes,
			lastUpdated: Date.now(),
		})
	},
})

/**
 * Update global mapping with vote counts (for bulk operations)
 */
export const updateGlobalMappingWithVotes = internalMutation({
	args: {
		merchantName: v.string(),
		category: v.string(),
		voteCount: v.number(),
		categoryVotes: v.optional(v.any()),
	},
	handler: async (ctx, { merchantName, category, voteCount, categoryVotes }) => {
		const existing = await ctx.db
			.query("merchantMappings")
			.withIndex("by_merchant", (q) => q.eq("merchantName", merchantName))
			.first()

		if (!existing) {
			throw new Error(`Merchant mapping not found: ${merchantName}`)
		}

		await ctx.db.patch(existing._id, {
			category,
			confidence: "consensus",
			voteCount,
			categoryVotes,
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
 *
 * PHASE 1 IMPROVEMENTS:
 * - Enhanced logging to track cache hits vs AI calls
 * - Better error propagation for rate limit handling
 *
 * PHASE 2 IMPROVEMENTS:
 * - Optional retry logic with exponential backoff
 * - Enhanced logging with attempt tracking
 * - Detailed return type with categorization metadata
 */
export const getCategoryForMerchant = action({
	args: {
		merchantName: v.string(),
		description: v.string(),
		userId: v.optional(v.string()),
		enableRetry: v.optional(v.boolean()), // Enable exponential backoff retry (Phase 2)
		maxRetries: v.optional(v.number()), // Max retry attempts (default: 3)
	},
	handler: async (ctx, { merchantName, description, userId, enableRetry = false, maxRetries = 3 }): Promise<{
		category: string
		source: "personal" | "global" | "ai" | "ai-retry"
		attempts?: number
		retryDelays?: number[]
	}> => {
		// 1. Check personal mapping first (highest priority)
		if (userId) {
			const personal = await ctx.runQuery(api.categorization.getPersonalMapping, { userId, merchantName })
			if (personal) {
				console.log(`[getCategoryForMerchant] ✓ Personal mapping found for ${merchantName}: ${personal.category}`)
				return {
					category: personal.category,
					source: "personal",
				}
			}
		}

		// 2. Check global mapping
		const global = await ctx.runQuery(api.categorization.getGlobalMapping, { merchantName })
		if (global) {
			console.log(
				`[getCategoryForMerchant] ✓ Global mapping found for ${merchantName}: ${global.category} (confidence: ${global.confidence})`,
			)
			return {
				category: global.category,
				source: "global",
			}
		}

		// 3. Use AI to categorize (with optional retry logic)
		console.log(`[getCategoryForMerchant] No cached mapping for ${merchantName}, calling AI...`)

		try {
			let category: string
			let attempts = 1
			let retryDelays: number[] = []
			let source: "ai" | "ai-retry" = "ai"

			if (enableRetry) {
				// PHASE 2: Use retry logic with exponential backoff
				console.log(`[getCategoryForMerchant] Using retry logic (max ${maxRetries} attempts)`)
				const retryResult = await ctx.runAction(api.categorization.categorizeMerchantWithRetry, {
					merchantName,
					description,
					maxRetries,
				})
				category = retryResult.category
				attempts = retryResult.attempts
				retryDelays = retryResult.retryDelays
				source = retryResult.attempts > 1 ? "ai-retry" : "ai"

				console.log(
					`[getCategoryForMerchant] ✓ AI categorized ${merchantName} as ${category} after ${attempts} attempt(s)`,
				)
			} else {
				// PHASE 1: Single attempt (may throw RATE_LIMIT error)
				category = await ctx.runAction(api.categorization.categorizeMerchantWithAI, {
					merchantName,
					description,
				})
			}

			// 4. Store in global mapping for future use
			await ctx.runMutation(internal.categorization.upsertGlobalMapping, {
				merchantName,
				category,
				confidence: "ai",
				aiSuggestion: category,
			})

			console.log(`[getCategoryForMerchant] ✓ AI categorized ${merchantName} as ${category}, saved to global mapping`)

			return {
				category,
				source,
				attempts,
				retryDelays,
			}
		} catch (error) {
			// Propagate rate limit errors upstream so they can be handled gracefully
			if ((error as Error).message?.startsWith("RATE_LIMIT")) {
				console.error(`[getCategoryForMerchant] Rate limit error for ${merchantName}, propagating upstream`)
				throw error
			}

			// For other errors, log and re-throw
			console.error(`[getCategoryForMerchant] Unexpected error for ${merchantName}:`, error)
			throw error
		}
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
			await ctx.runMutation(internal.categorization.upsertPersonalMapping, {
				userId: args.userId,
				merchantName: args.merchantName,
				category: args.category,
			})
		}

		// 3. Vote on global mapping (helps crowd-sourcing)
		await ctx.runMutation(internal.categorization.voteForCategory, {
			merchantName: args.merchantName,
			category: args.category,
		})

		return { success: true }
	},
})

/**
 * Categorize all uncategorized expenses with AI
 * This backfills existing expenses that don't have categories yet
 */
export const categorizeExistingExpenses = action({
	args: {
		userId: v.optional(v.string()),
		delayMs: v.optional(v.number()), // Delay between API calls to avoid rate limiting
	},
	handler: async (ctx, args): Promise<{
		totalExpenses: number
		alreadyCategorized: number
		newlyCategorized: number
		errors: number
		rateLimitResetTime?: number
	}> => {
		const { normalizeMerchant } = await import("./utils")

		// Get all expenses
		const allExpenses = await ctx.runQuery(api.expenses.getAllExpenses)

		let alreadyCategorized = 0
		let newlyCategorized = 0
		let errors = 0
		const delayMs = args.delayMs ?? 4000 // Default 4 seconds between calls (15 per minute for 16/min limit)

		// Process expenses that don't have categories
		for (const expense of allExpenses) {
			if (expense.category && expense.merchantName) {
				alreadyCategorized++
				continue
			}

			try {
				// Normalize merchant name
				const merchantName = normalizeMerchant(expense.name)

				// Get category for this merchant (Phase 2: returns object with category and metadata)
				const result = await ctx.runAction(
					api.categorization.getCategoryForMerchant,
					{
						merchantName,
						description: expense.name,
						userId: args.userId,
						enableRetry: false, // Disable retry for backfill to avoid long delays
					},
				)

				// Update the expense with category and merchant name
				await ctx.runMutation(
					internal.expenses.updateExpenseWithCategoryAndMerchant,
					{
						expenseId: expense.expenseId,
						category: result.category,
						merchantName,
					},
				)

				newlyCategorized++

				// Add delay between API calls to avoid rate limiting
				if (delayMs > 0) {
					await new Promise((resolve) => setTimeout(resolve, delayMs))
				}
			} catch (error) {
				console.error(`Error categorizing expense ${expense.expenseId}:`, error)

				// Check if this is a rate limit error
				const errorMessage = (error as Error).message
				if (errorMessage?.startsWith("RATE_LIMIT")) {
					const parts = errorMessage.split(":")
					if (parts.length > 1) {
						return {
							totalExpenses: allExpenses.length,
							alreadyCategorized,
							newlyCategorized,
							errors,
							rateLimitResetTime: Number.parseInt(parts[1]),
						}
					}
					return {
						totalExpenses: allExpenses.length,
						alreadyCategorized,
						newlyCategorized,
						errors,
						rateLimitResetTime: Date.now() + 60000, // Default to 1 minute from now
					}
				}

				errors++
			}
		}

		return {
			totalExpenses: allExpenses.length,
			alreadyCategorized,
			newlyCategorized,
			errors,
		}
	},
})

/**
 * Scan all existing expenses and populate global merchant mappings
 * This is useful for building the mapping table from historical data
 */
export const populateMerchantMappingsFromExpenses = action({
	args: {},
	handler: async (ctx): Promise<{
		processedMerchants: number
		createdMappings: number
		updatedMappings: number
		skippedMerchants: number
	}> => {
		// Get all expenses that have both category and merchantName
		const allExpenses = await ctx.runQuery(api.expenses.getAllExpenses)

		// Filter to only expenses with categories and merchant names
		const categorizedExpenses = allExpenses.filter(
			(e) => e.category && e.merchantName,
		)

		// Group expenses by merchantName and count categories
		const merchantStats = new Map<string, Map<string, number>>()

		for (const expense of categorizedExpenses) {
			if (!expense.merchantName || !expense.category) continue

			if (!merchantStats.has(expense.merchantName)) {
				merchantStats.set(expense.merchantName, new Map())
			}

			const categoryMap = merchantStats.get(expense.merchantName)!
			const currentCount = categoryMap.get(expense.category) || 0
			categoryMap.set(expense.category, currentCount + 1)
		}

		// Process each merchant
		let createdMappings = 0
		let updatedMappings = 0
		let skippedMerchants = 0

		for (const [merchantName, categoryVotes] of merchantStats.entries()) {
			// Find the most common category
			let mostCommonCategory = ""
			let maxVotes = 0

			for (const [category, votes] of categoryVotes.entries()) {
				if (votes > maxVotes) {
					maxVotes = votes
					mostCommonCategory = category
				}
			}

			// Skip if no category found (shouldn't happen but be safe)
			if (!mostCommonCategory) {
				skippedMerchants++
				continue
			}

			// Check if mapping already exists
			const existingMapping = await ctx.runQuery(
				api.categorization.getGlobalMapping,
				{ merchantName },
			)

			// Convert categoryVotes Map to a plain object for storage
			const categoryVotesObj: Record<string, number> = {}
			for (const [category, votes] of categoryVotes.entries()) {
				categoryVotesObj[category] = votes
			}

			if (existingMapping) {
				// Update existing mapping with new data
				await ctx.runMutation(
					internal.categorization.updateGlobalMappingWithVotes,
					{
						merchantName,
						category: mostCommonCategory,
						voteCount: maxVotes,
						categoryVotes: categoryVotesObj,
					},
				)
				updatedMappings++
			} else {
				// Create new mapping
				await ctx.runMutation(
					internal.categorization.createGlobalMappingWithVotes,
					{
						merchantName,
						category: mostCommonCategory,
						voteCount: maxVotes,
						categoryVotes: categoryVotesObj,
					},
				)
				createdMappings++
			}
		}

		return {
			processedMerchants: merchantStats.size,
			createdMappings,
			updatedMappings,
			skippedMerchants,
		}
	},
})

/**
 * Get all custom categories
 */
export const getAllCustomCategories = query({
	args: {},
	handler: async (ctx) => {
		const customCategories = await ctx.db.query("customCategories").collect()
		return customCategories.map((cat) => cat.name)
	},
})

/**
 * Get all categories that are actually used in expenses (default + custom)
 */
export const getUsedCategories = query({
	args: {},
	handler: async (ctx) => {
		// Get all expenses
		const expenses = await ctx.db.query("expenses").collect()

		// Extract unique categories
		const usedCategories = new Set<string>()
		for (const expense of expenses) {
			if (expense.category) {
				usedCategories.add(expense.category)
			}
		}

		// Return sorted array
		return Array.from(usedCategories).sort()
	},
})

/**
 * Add a new custom category
 */
export const addCustomCategory = mutation({
	args: {
		name: v.string(),
	},
	handler: async (ctx, { name }) => {
		// Trim and validate the name
		const trimmedName = name.trim()
		if (!trimmedName) {
			throw new Error("Category name cannot be empty")
		}

		// Check if category already exists (case-insensitive)
		const existing = await ctx.db
			.query("customCategories")
			.withIndex("by_name", (q) => q.eq("name", trimmedName))
			.first()

		if (existing) {
			throw new Error(`Category "${trimmedName}" already exists`)
		}

		// Check if it matches a default category (case-insensitive)
		const isDefaultCategory = CATEGORIES.some(
			(cat) => cat.toLowerCase() === trimmedName.toLowerCase(),
		)
		if (isDefaultCategory) {
			throw new Error(`"${trimmedName}" is already a default category`)
		}

		// Create the custom category
		await ctx.db.insert("customCategories", {
			name: trimmedName,
			createdAt: Date.now(),
		})

		return trimmedName
	},
})
