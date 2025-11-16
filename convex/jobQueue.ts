/**
 * Background job queue for expense categorization (Phase 3)
 *
 * This module provides a non-blocking categorization system using a job queue.
 * Jobs are processed by a scheduled worker that respects rate limits.
 */

import { v } from "convex/values"
import { internalMutation, internalQuery } from "./_generated/server"

/**
 * Creates a new categorization job
 * Called when uploading expenses to queue categorization
 */
export const createJob = internalMutation({
	args: {
		expenseId: v.string(),
		merchantName: v.string(),
		description: v.string(),
		userId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Check if job already exists for this expense
		const existingJob = await ctx.db
			.query("categorizationJobs")
			.withIndex("by_expense_id", (q) => q.eq("expenseId", args.expenseId))
			.first()

		if (existingJob) {
			// Job already exists, don't create duplicate
			return existingJob._id
		}

		// Create new job
		const jobId = await ctx.db.insert("categorizationJobs", {
			expenseId: args.expenseId,
			merchantName: args.merchantName,
			description: args.description,
			userId: args.userId,
			status: "pending",
			attempts: 0,
			createdAt: Date.now(),
		})

		return jobId
	},
})

/**
 * Gets pending jobs ready to be processed
 * Returns jobs that are:
 * - status = "pending" OR
 * - status = "failed" and nextRetry <= now
 *
 * Limits to maxJobs to respect rate limits
 */
export const getPendingJobs = internalQuery({
	args: {
		maxJobs: v.number(), // Max jobs to return (for rate limiting)
	},
	handler: async (ctx, { maxJobs }) => {
		const now = Date.now()

		// Get pending jobs (never attempted)
		const pendingJobs = await ctx.db
			.query("categorizationJobs")
			.withIndex("by_status", (q) => q.eq("status", "pending"))
			.order("asc") // FIFO order
			.take(maxJobs)

		// Get failed jobs ready for retry
		const failedJobs = await ctx.db
			.query("categorizationJobs")
			.withIndex("by_status", (q) => q.eq("status", "failed"))
			.collect()

		// Filter failed jobs by nextRetry time
		const retryableJobs = failedJobs
			.filter((job) => job.nextRetry && job.nextRetry <= now)
			.slice(0, maxJobs - pendingJobs.length)

		// Combine and return
		return [...pendingJobs, ...retryableJobs]
	},
})

/**
 * Marks a job as processing
 * Updates status and lastAttempt timestamp
 */
export const markJobAsProcessing = internalMutation({
	args: {
		jobId: v.id("categorizationJobs"),
	},
	handler: async (ctx, { jobId }) => {
		await ctx.db.patch(jobId, {
			status: "processing",
			lastAttempt: Date.now(),
		})
	},
})

/**
 * Marks a job as completed
 * Updates status and increments attempts
 */
export const markJobAsCompleted = internalMutation({
	args: {
		jobId: v.id("categorizationJobs"),
	},
	handler: async (ctx, { jobId }) => {
		const job = await ctx.db.get(jobId)
		if (!job) return

		await ctx.db.patch(jobId, {
			status: "completed",
			attempts: job.attempts + 1,
		})
	},
})

/**
 * Marks a job as failed with exponential backoff
 * Updates status, attempts, error, and nextRetry timestamp
 */
export const markJobAsFailed = internalMutation({
	args: {
		jobId: v.id("categorizationJobs"),
		error: v.string(),
	},
	handler: async (ctx, { jobId, error }) => {
		const job = await ctx.db.get(jobId)
		if (!job) return

		const attempts = job.attempts + 1

		// Exponential backoff: 1min, 5min, 30min, 2h, 12h, 24h
		const backoffMinutes = [1, 5, 30, 120, 720, 1440]
		const backoffMs =
			(backoffMinutes[Math.min(attempts - 1, backoffMinutes.length - 1)] || 1440) *
			60 *
			1000

		const nextRetry = Date.now() + backoffMs

		await ctx.db.patch(jobId, {
			status: "failed",
			attempts,
			error,
			nextRetry,
		})
	},
})

/**
 * Gets job statistics for monitoring
 * Returns counts by status
 */
export const getJobStats = internalQuery({
	args: {},
	handler: async (ctx) => {
		const allJobs = await ctx.db.query("categorizationJobs").collect()

		const stats = {
			total: allJobs.length,
			pending: 0,
			processing: 0,
			completed: 0,
			failed: 0,
			retryable: 0, // Failed jobs ready for retry
		}

		const now = Date.now()

		for (const job of allJobs) {
			if (job.status === "pending") stats.pending++
			else if (job.status === "processing") stats.processing++
			else if (job.status === "completed") stats.completed++
			else if (job.status === "failed") {
				stats.failed++
				if (job.nextRetry && job.nextRetry <= now) {
					stats.retryable++
				}
			}
		}

		return stats
	},
})

/**
 * Cleans up old completed jobs
 * Removes jobs completed more than 7 days ago
 */
export const cleanupCompletedJobs = internalMutation({
	args: {},
	handler: async (ctx) => {
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

		const oldJobs = await ctx.db
			.query("categorizationJobs")
			.withIndex("by_status", (q) => q.eq("status", "completed"))
			.filter((q) => q.lt(q.field("createdAt"), sevenDaysAgo))
			.collect()

		for (const job of oldJobs) {
			await ctx.db.delete(job._id)
		}

		return { deleted: oldJobs.length }
	},
})

/**
 * Gets all jobs for a specific expense
 * Useful for debugging
 */
export const getJobsByExpense = internalQuery({
	args: {
		expenseId: v.string(),
	},
	handler: async (ctx, { expenseId }) => {
		return await ctx.db
			.query("categorizationJobs")
			.withIndex("by_expense_id", (q) => q.eq("expenseId", expenseId))
			.collect()
	},
})
