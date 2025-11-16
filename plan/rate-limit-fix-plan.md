# Rate Limit Error Fix - Implementation Plan

## Problem Analysis

### Current Issue
When uploading PDFs with many unique merchants, the application hits OpenRouter's free tier rate limit (16 requests/minute), causing the entire upload to fail.

**Error Example:**
```
[ERROR] 'Error categorizing merchant NIB:' [Error: Uncaught Error: RATE_LIMIT
[ERROR] OpenRouter API error: 429
[ERROR] meta-llama/llama-3.2-3b-instruct:free is temporarily rate-limited upstream
```

### Root Cause
- `addExpensesWithCategories` processes all expenses sequentially
- Each unique merchant triggers an AI categorization call
- No rate limiting, delays, or retry logic
- Bulk uploads with many unique merchants exceed 16 req/min limit
- Entire upload fails if any categorization fails

### Current Flow (Broken)
```
Upload PDF → Parse → addExpensesWithCategories
  ↓
  For each expense:
    ↓
    getCategoryForMerchant → Check cache → AI call (NO DELAY)
    ↓
  If rate limited → ENTIRE UPLOAD FAILS ❌
```

---

## Phase 1: Immediate Fixes (1-2 hours)

**Goal:** Ensure uploads never fail, respect rate limits

### 1.1 Graceful Degradation
**Save expenses first, categorize later**

**Changes:**
- Modify `addExpensesWithCategories` to save all expenses immediately (category: undefined)
- Try to categorize each one
- If rate limited → continue with remaining expenses
- Return partial success status

**Benefits:**
- Users don't lose their data
- Uploads always succeed
- Categorization becomes non-blocking

### 1.2 Rate Limit Detection & Recovery
**Enhanced error handling with intelligent retry**

**Changes:**
- Improve error handling in `categorizeMerchantWithAI` (categorization.ts:25-119)
- Catch rate limit errors and continue processing
- Log which merchants failed
- Return list of uncategorized merchants

### 1.3 Configurable Delays Between AI Calls
**Prevent hitting rate limit in first place**

**Changes:**
- Add delay between categorization calls: 4000ms (4 seconds)
- This allows 15 req/min, safely under 16 req/min limit

**Rate Limit Math:**
- OpenRouter free tier: 16 req/min
- Safe rate: 15 req/min
- Delay needed: 60000ms / 15 = 4000ms (4 seconds)

### 1.4 Batch Deduplication
**Only categorize unique merchants once per upload**

**Changes:**
- Group expenses by normalized merchant name
- Categorize each unique merchant once
- Apply category to all expenses from that merchant

**Impact:**
Reduces API calls significantly (e.g., 50 Woolworths transactions → 1 API call)

### Implementation Checklist
- [ ] Modify `addExpensesWithCategories` to save expenses first
- [ ] Add merchant deduplication logic
- [ ] Add 4-second delay between AI categorization calls
- [ ] Wrap categorization in try-catch blocks
- [ ] Return detailed status (categorized count, failed merchants)
- [ ] Update error handling to continue on failure

---

## Phase 2: Short-Term Improvements (This Week, 4-6 hours)

**Goal:** Automatic retry with backoff, better UX

### 2.1 Exponential Backoff Retry Logic
**Retry failed categorizations with increasing delays**

```typescript
async function categorizeMerchantWithRetry(
  merchantName: string,
  description: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await categorizeMerchantWithAI(merchantName, description)
    } catch (error) {
      if (error.message.includes('RATE_LIMIT')) {
        const delay = Math.min(1000 * (2 ** attempt), 30000) // 1s, 2s, 4s...max 30s
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error // Non-rate-limit errors fail immediately
    }
  }

  return "Other" // Fallback after max retries
}
```

**Benefits:**
- Automatic retry for transient failures
- Exponential backoff prevents hammering API
- Graceful fallback to "Other" category

### 2.2 Enhanced User Feedback
**Show users what's happening during slow categorization**

**UI Changes:**
- Show progress during upload: "Categorizing 30/45 expenses..."
- Display estimated time remaining
- List which merchants were successfully categorized
- Show which merchants failed (can be manually categorized later)

**Return Type:**
```typescript
return {
  addedCount: 45,
  duplicateCount: 5,
  categorizedCount: 30,
  failedMerchants: ['NIB', 'ACME CORP'],
  uncategorizedExpenses: 15,
  totalMerchants: 35
}
```

### 2.3 Enhanced Logging
**Better debugging for production issues**

**Changes:**
- Log each categorization attempt with timestamp
- Track which merchants hit rate limits
- Monitor API call frequency
- Record retry attempts and outcomes

### Implementation Checklist
- [ ] Add exponential backoff retry function
- [ ] Integrate retry logic into categorization flow
- [ ] Update return types to include detailed status
- [ ] Add comprehensive logging
- [ ] Update UI to show categorization progress (future)

---

## Phase 3: Long-Term Architecture (Next Sprint, 8-12 hours)

**Goal:** Background processing, intelligent throttling, offline resilience

### 3.1 Background Job Queue System
**Deferred categorization with scheduled workers**

**New Schema Tables:**
```typescript
// convex/schema.ts
categorizationJobs: defineTable({
  expenseId: v.string(),
  merchantName: v.string(),
  description: v.string(),
  userId: v.optional(v.string()),
  status: v.string(), // "pending" | "processing" | "completed" | "failed"
  attempts: v.number(),
  lastAttempt: v.optional(v.number()),
  nextRetry: v.optional(v.number()),
  error: v.optional(v.string()),
  createdAt: v.number(),
}).index("by_status", ["status"])
  .index("by_next_retry", ["nextRetry"])
```

**Worker Pattern:**
```typescript
// Scheduled function (runs every 5 seconds)
export const processCategoryQueue = internalAction({
  handler: async (ctx) => {
    // 1. Get pending jobs ready for retry
    const jobs = await getPendingJobs({ limit: 15 }) // Max 15 per minute

    // 2. Process each job with delay
    for (const job of jobs) {
      try {
        const category = await categorizeMerchantWithAI(
          job.merchantName,
          job.description
        )
        await updateExpenseCategory(job.expenseId, category)
        await markJobCompleted(job._id)
      } catch (error) {
        await scheduleRetry(job._id, exponentialBackoff(job.attempts))
      }

      await delay(4000) // 4 second spacing
    }
  }
})
```

**Benefits:**
- Categorization happens in background
- User doesn't wait for AI calls
- Automatic retry with smart scheduling
- Can process indefinitely until all expenses categorized

### 3.2 Rate Limit Tracking & Preemptive Throttling
**Track API usage to prevent hitting limits**

**New Schema:**
```typescript
rateLimitState: defineTable({
  provider: v.string(), // "openrouter"
  requestCount: v.number(),
  windowStart: v.number(),
  lastReset: v.number(),
})
```

**Logic:**
```typescript
// Check before making request
if (requestCount >= 15 && withinCurrentMinute) {
  // Queue for later instead of failing
  await createCategorizationJob(expense)
  return null // Will be processed by background worker
}
```

**Benefits:**
- Proactive prevention of rate limits
- Smooth distribution of API calls
- Better resource utilization

### 3.3 Heuristic-Based Fallback Categorization
**Smart defaults based on merchant keywords when AI unavailable**

**Implementation:**
```typescript
const merchantKeywords = {
  "Groceries": ["woolworths", "coles", "iga", "aldi", "supermarket"],
  "Fuel": ["bp", "shell", "caltex", "7-eleven", "ampol", "fuel"],
  "Dining & Takeaway": ["mcdonald", "kfc", "pizza", "restaurant", "cafe", "uber eats"],
  "Transport": ["uber", "taxi", "train", "bus", "metro", "toll"],
  "Bills & Utilities": ["telstra", "optus", "energy", "water", "electricity", "gas"],
  "Health & Medical": ["pharmacy", "chemist", "doctor", "dental", "medical"],
  "Entertainment": ["cinema", "netflix", "spotify", "disney", "steam"],
  "Shopping": ["kmart", "target", "bigw", "amazon", "ebay"],
  // ...
}

function heuristicCategorize(merchantName: string): string | null {
  const normalized = merchantName.toLowerCase()
  for (const [category, keywords] of Object.entries(merchantKeywords)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      return category
    }
  }
  return null
}
```

**Usage:**
```typescript
// In getCategoryForMerchant, before AI call:
const heuristicCategory = heuristicCategorize(merchantName)
if (heuristicCategory) {
  // Still call AI, but use heuristic as fallback
  try {
    return await aiCategorize(...)
  } catch (error) {
    console.log(`Using heuristic fallback for ${merchantName}`)
    return heuristicCategory
  }
}
```

**Benefits:**
- Instant categorization for common merchants
- Reduces AI API calls
- Works offline
- Good fallback when rate limited

### 3.4 Cron Job for Uncategorized Expenses
**Scheduled cleanup to categorize old expenses**

```typescript
// Run daily at 2 AM
export const dailyCategorization = internalAction({
  handler: async (ctx) => {
    // Find expenses without categories
    const uncategorized = await getUncategorizedExpenses()

    // Process slowly over time (won't hit rate limits)
    for (const expense of uncategorized) {
      await categorizeExpense(expense)
      await delay(4000) // 15 per minute
    }
  }
})
```

### Implementation Checklist
- [ ] Design and implement categorizationJobs table
- [ ] Create background worker function
- [ ] Implement job scheduling logic
- [ ] Add rate limit tracking table
- [ ] Implement preemptive throttling
- [ ] Build heuristic categorization engine
- [ ] Add keyword mappings for common merchants
- [ ] Create daily cleanup cron job
- [ ] Add UI to show background categorization status

---

## Success Metrics

### Phase 1 Success Criteria
- ✅ No upload failures due to rate limits
- ✅ All expenses saved to database (even if uncategorized)
- ✅ At least 50% of expenses categorized on first upload
- ✅ Clear error messages for users

### Phase 2 Success Criteria
- ✅ 90%+ success rate for categorization (with retries)
- ✅ Users see categorization progress
- ✅ Failed categorizations logged for analysis

### Phase 3 Success Criteria
- ✅ 100% of expenses eventually categorized
- ✅ Zero user-facing rate limit errors
- ✅ Background jobs complete within 24 hours
- ✅ Heuristic categorization for 70%+ of common merchants

---

## Rollback Plan

### Phase 1
If issues occur:
1. Remove delays (may cause rate limits again)
2. Revert to original synchronous flow
3. Keep graceful degradation logic

### Phase 2
If retry logic causes issues:
1. Disable exponential backoff
2. Revert to single-attempt categorization
3. Keep Phase 1 fixes

### Phase 3
If background jobs fail:
1. Disable scheduled workers
2. Fall back to Phase 1/2 inline categorization
3. Manually trigger categorization for stuck jobs

---

## Timeline

| Phase | Duration | Start | Completion |
|-------|----------|-------|------------|
| Phase 1 | 1-2 hours | Today | Today |
| Phase 2 | 4-6 hours | This week | This week |
| Phase 3 | 8-12 hours | Next sprint | Next sprint |

**Total Estimated Effort:** 13-20 hours across 2 sprints

---

## Notes

- Free tier limit: 16 req/min for `meta-llama/llama-3.2-3b-instruct:free`
- Consider upgrading to paid tier if business grows (higher limits)
- Monitor OpenRouter dashboard for actual usage patterns
- May want to implement local caching of categories to reduce API calls further
