/**
 * Background worker for processing categorization jobs (Phase 3)
 *
 * Scheduled function that runs every 5 seconds to process pending jobs.
 * Respects rate limits by processing max 15 jobs per minute.
 */

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { categorizeByHeuristics } from "./heuristics"

/**
 * Processes pending categorization jobs
 *
 * Scheduled to run every 5 seconds (via convex.json or dashboard)
 * Processes up to 1 job per run = max 12 jobs/minute (safe under 15/min limit)
 */
export const processJobs = internalAction({
	args: {},
	handler: async (ctx) => {
		const startTime = Date.now()

		// Get pending jobs (limit to 1 per run for safety)
		const jobs = await ctx.runQuery(internal.jobQueue.getPendingJobs, {
			maxJobs: 1,
		})

		if (jobs.length === 0) {
			// No jobs to process
			return {
				processed: 0,
				duration: Date.now() - startTime,
			}
		}

		let successCount = 0
		let failCount = 0

		// Process each job
		for (const job of jobs) {
			try {
				// Mark as processing
				await ctx.runMutation(internal.jobQueue.markJobAsProcessing, {
					jobId: job._id,
				})

				// Try heuristic categorization first
				let category = categorizeByHeuristics(job.merchantName, job.description)

				// If heuristic failed, try AI categorization
				if (!category) {
					// Check rate limit before making AI call
					const canMakeRequest = await ctx.runMutation(
						internal.rateLimit.canMakeRequest,
						{
							provider: "openrouter",
						},
					)

					if (!canMakeRequest) {
						// Rate limited, mark job as failed with short retry
						await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
							jobId: job._id,
							error: "Rate limited - will retry soon",
						})
						failCount++
						continue
					}

					// Record request
					await ctx.runMutation(internal.rateLimit.recordRequest, {
						provider: "openrouter",
					})

					// Call AI categorization
					try {
						const result = await ctx.runAction(internal.categorization.categorizeMerchantWithRetry, {
							merchantName: job.merchantName,
							description: job.description,
							maxRetries: 2, // Reduced retries for background jobs
						})
						category = result.category
					} catch (error) {
						// AI call failed
						await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
							jobId: job._id,
							error: error instanceof Error ? error.message : "AI categorization failed",
						})
						failCount++
						continue
					}

					// Add delay after AI call (4 seconds)
					await new Promise((resolve) => setTimeout(resolve, 4000))
				}

				// Update expense with category
				if (category) {
					await ctx.runMutation(internal.categorization.updateExpenseCategory, {
						expenseId: job.expenseId,
						category,
						merchantName: job.merchantName,
						userId: job.userId,
					})

					// Mark job as completed
					await ctx.runMutation(internal.jobQueue.markJobAsCompleted, {
						jobId: job._id,
					})
					successCount++
				} else {
					// No category found
					await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
						jobId: job._id,
						error: "Could not determine category",
					})
					failCount++
				}
			} catch (error) {
				// Unexpected error
				await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
					jobId: job._id,
					error: error instanceof Error ? error.message : "Unexpected error",
				})
				failCount++
			}
		}

		return {
			processed: jobs.length,
			succeeded: successCount,
			failed: failCount,
			duration: Date.now() - startTime,
		}
	},
})

/**
 * Manual trigger for processing all pending jobs
 * Useful for testing or catching up after downtime
 *
 * Processes jobs in batches with delays to respect rate limits
 */
export const processPendingJobsBatch = internalAction({
	args: {},
	handler: async (ctx) => {
		const startTime = Date.now()
		let totalProcessed = 0
		let totalSucceeded = 0
		let totalFailed = 0

		// Process in batches of 15 (one minute's worth)
		while (true) {
			const jobs = await ctx.runQuery(internal.jobQueue.getPendingJobs, {
				maxJobs: 15,
			})

			if (jobs.length === 0) {
				break // No more jobs
			}

			// Process this batch
			for (const job of jobs) {
				try {
					await ctx.runMutation(internal.jobQueue.markJobAsProcessing, {
						jobId: job._id,
					})

					// Try heuristic first
					let category = categorizeByHeuristics(job.merchantName, job.description)

					// If heuristic failed, try AI
					if (!category) {
						const canMakeRequest = await ctx.runMutation(
							internal.rateLimit.canMakeRequest,
							{
								provider: "openrouter",
							},
						)

						if (!canMakeRequest) {
							await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
								jobId: job._id,
								error: "Rate limited - will retry",
							})
							totalFailed++
							continue
						}

						await ctx.runMutation(internal.rateLimit.recordRequest, {
							provider: "openrouter",
						})

						try {
							const result = await ctx.runAction(
								internal.categorization.categorizeMerchantWithRetry,
								{
									merchantName: job.merchantName,
									description: job.description,
									maxRetries: 2,
								},
							)
							category = result.category
						} catch (error) {
							await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
								jobId: job._id,
								error: error instanceof Error ? error.message : "AI failed",
							})
							totalFailed++
							continue
						}

						// Delay after AI call
						await new Promise((resolve) => setTimeout(resolve, 4000))
					}

					if (category) {
						await ctx.runMutation(internal.categorization.updateExpenseCategory, {
							expenseId: job.expenseId,
							category,
							merchantName: job.merchantName,
							userId: job.userId,
						})

						await ctx.runMutation(internal.jobQueue.markJobAsCompleted, {
							jobId: job._id,
						})
						totalSucceeded++
					} else {
						await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
							jobId: job._id,
							error: "No category found",
						})
						totalFailed++
					}

					totalProcessed++
				} catch (error) {
					await ctx.runMutation(internal.jobQueue.markJobAsFailed, {
						jobId: job._id,
						error: error instanceof Error ? error.message : "Error",
					})
					totalFailed++
					totalProcessed++
				}
			}

			// Wait 60 seconds before next batch (rate limit window)
			if (jobs.length === 15) {
				await new Promise((resolve) => setTimeout(resolve, 60000))
			}
		}

		return {
			totalProcessed,
			totalSucceeded,
			totalFailed,
			duration: Date.now() - startTime,
		}
	},
})
