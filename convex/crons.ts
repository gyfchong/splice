/**
 * Convex Cron Jobs Configuration (Phase 3)
 *
 * Scheduled jobs for background categorization and maintenance.
 */

import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

/**
 * Background job processor
 * Runs every 5 seconds to process pending categorization jobs
 * Processes 1 job per run = max 12 jobs/minute (safe under 15/min limit)
 */
crons.interval(
	"process-categorization-jobs",
	{ seconds: 5 },
	internal.categorizationWorker.processJobs,
)

/**
 * Daily categorization job
 * Runs daily at 2 AM to categorize any uncategorized expenses
 * Uses heuristics first, queues AI jobs for unknowns
 */
crons.daily(
	"daily-categorization",
	{ hourUTC: 2, minuteUTC: 0 }, // 2:00 AM UTC
	internal.cronJobs.dailyCategorization,
)

/**
 * Daily cleanup job
 * Runs daily at 3 AM to clean up old completed jobs
 * Removes jobs older than 7 days
 */
crons.daily(
	"daily-cleanup",
	{ hourUTC: 3, minuteUTC: 0 }, // 3:00 AM UTC
	internal.cronJobs.dailyCleanup,
)

/**
 * Weekly statistics report
 * Runs every Sunday at 4 AM to generate performance stats
 * Useful for monitoring categorization effectiveness
 */
crons.weekly(
	"weekly-stats",
	{ dayOfWeek: "sunday", hourUTC: 4, minuteUTC: 0 },
	internal.cronJobs.weeklyStats,
)

export default crons
