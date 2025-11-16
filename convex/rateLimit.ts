/**
 * Rate limit tracking and preemptive throttling (Phase 3)
 *
 * Tracks API request counts and prevents hitting rate limits proactively.
 * Implements a sliding window approach for accurate rate limiting.
 */

import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

// Rate limit configuration
const RATE_LIMITS = {
	openrouter: {
		requestsPerMinute: 15, // Safe limit (actual is 16, but use 15 for safety)
		windowMs: 60 * 1000, // 60 seconds
	},
}

/**
 * Checks if we can make a request without hitting rate limits
 * Returns true if request can be made, false if rate limited
 */
export const canMakeRequest = internalMutation({
	args: {
		provider: v.string(), // e.g., "openrouter"
	},
	handler: async (ctx, { provider }) => {
		const config = RATE_LIMITS[provider as keyof typeof RATE_LIMITS]
		if (!config) {
			// Unknown provider, allow request
			return true
		}

		const now = Date.now()

		// Get or create rate limit state
		const existing = await ctx.db
			.query("rateLimitState")
			.withIndex("by_provider", (q) => q.eq("provider", provider))
			.first()

		if (!existing) {
			// No state yet, create it
			await ctx.db.insert("rateLimitState", {
				provider,
				requestCount: 0,
				windowStart: now,
				lastReset: now,
			})
			return true
		}

		// Check if window has expired
		const windowAge = now - existing.windowStart
		if (windowAge >= config.windowMs) {
			// Reset window
			await ctx.db.patch(existing._id, {
				requestCount: 0,
				windowStart: now,
				lastReset: now,
			})
			return true
		}

		// Check if we're under the limit
		if (existing.requestCount < config.requestsPerMinute) {
			return true
		}

		// Rate limited
		return false
	},
})

/**
 * Records a request being made
 * Call this AFTER making the actual API request
 */
export const recordRequest = internalMutation({
	args: {
		provider: v.string(),
	},
	handler: async (ctx, { provider }) => {
		const config = RATE_LIMITS[provider as keyof typeof RATE_LIMITS]
		if (!config) {
			return // Unknown provider, don't track
		}

		const now = Date.now()

		// Get state
		const existing = await ctx.db
			.query("rateLimitState")
			.withIndex("by_provider", (q) => q.eq("provider", provider))
			.first()

		if (!existing) {
			// Create new state
			await ctx.db.insert("rateLimitState", {
				provider,
				requestCount: 1,
				windowStart: now,
				lastReset: now,
				lastRequest: now,
			})
			return
		}

		// Check if window expired
		const windowAge = now - existing.windowStart
		if (windowAge >= config.windowMs) {
			// Reset window with this request
			await ctx.db.patch(existing._id, {
				requestCount: 1,
				windowStart: now,
				lastReset: now,
				lastRequest: now,
			})
			return
		}

		// Increment count
		await ctx.db.patch(existing._id, {
			requestCount: existing.requestCount + 1,
			lastRequest: now,
		})
	},
})

/**
 * Gets current rate limit status for a provider
 * Useful for monitoring and debugging
 */
export const getRateLimitStatus = internalQuery({
	args: {
		provider: v.string(),
	},
	handler: async (ctx, { provider }) => {
		const config = RATE_LIMITS[provider as keyof typeof RATE_LIMITS]
		if (!config) {
			return {
				provider,
				unknown: true,
			}
		}

		const state = await ctx.db
			.query("rateLimitState")
			.withIndex("by_provider", (q) => q.eq("provider", provider))
			.first()

		if (!state) {
			return {
				provider,
				requestCount: 0,
				limit: config.requestsPerMinute,
				windowMs: config.windowMs,
				remaining: config.requestsPerMinute,
				resetIn: 0,
			}
		}

		const now = Date.now()
		const windowAge = now - state.windowStart
		const resetIn = Math.max(0, config.windowMs - windowAge)

		return {
			provider,
			requestCount: state.requestCount,
			limit: config.requestsPerMinute,
			windowMs: config.windowMs,
			remaining: Math.max(0, config.requestsPerMinute - state.requestCount),
			resetIn,
			windowStart: state.windowStart,
			lastRequest: state.lastRequest,
		}
	},
})

/**
 * Manually resets rate limit state for a provider
 * Useful for testing or recovering from errors
 */
export const resetRateLimit = internalMutation({
	args: {
		provider: v.string(),
	},
	handler: async (ctx, { provider }) => {
		const existing = await ctx.db
			.query("rateLimitState")
			.withIndex("by_provider", (q) => q.eq("provider", provider))
			.first()

		if (!existing) {
			return { reset: false, message: "No state to reset" }
		}

		await ctx.db.patch(existing._id, {
			requestCount: 0,
			windowStart: Date.now(),
			lastReset: Date.now(),
		})

		return { reset: true, message: "Rate limit reset" }
	},
})

/**
 * Gets rate limit status for all providers
 */
export const getAllRateLimitStatus = internalQuery({
	args: {},
	handler: async (ctx) => {
		const allStates = await ctx.db.query("rateLimitState").collect()

		const status = []

		for (const provider of Object.keys(RATE_LIMITS)) {
			const state = allStates.find((s) => s.provider === provider)
			const config = RATE_LIMITS[provider as keyof typeof RATE_LIMITS]

			if (!state) {
				status.push({
					provider,
					requestCount: 0,
					limit: config.requestsPerMinute,
					remaining: config.requestsPerMinute,
					resetIn: 0,
				})
			} else {
				const now = Date.now()
				const windowAge = now - state.windowStart
				const resetIn = Math.max(0, config.windowMs - windowAge)

				status.push({
					provider,
					requestCount: state.requestCount,
					limit: config.requestsPerMinute,
					remaining: Math.max(0, config.requestsPerMinute - state.requestCount),
					resetIn,
					lastRequest: state.lastRequest,
				})
			}
		}

		return status
	},
})

/**
 * Calculates recommended delay before next request
 * Returns delay in milliseconds
 */
export const getRecommendedDelay = internalQuery({
	args: {
		provider: v.string(),
	},
	handler: async (ctx, { provider }) => {
		const config = RATE_LIMITS[provider as keyof typeof RATE_LIMITS]
		if (!config) {
			return 0 // Unknown provider
		}

		const state = await ctx.db
			.query("rateLimitState")
			.withIndex("by_provider", (q) => q.eq("provider", provider))
			.first()

		if (!state || state.requestCount === 0) {
			return 0 // No requests yet, no delay needed
		}

		const now = Date.now()
		const windowAge = now - state.windowStart

		// If window expired, no delay needed
		if (windowAge >= config.windowMs) {
			return 0
		}

		// Calculate delay to evenly distribute requests
		// e.g., 15 requests/60s = 1 request every 4 seconds
		const idealDelay = config.windowMs / config.requestsPerMinute

		// If we're close to limit, calculate time until window resets
		if (state.requestCount >= config.requestsPerMinute - 1) {
			// Wait until window resets
			return Math.max(0, config.windowMs - windowAge)
		}

		// Return ideal delay
		return idealDelay
	},
})
