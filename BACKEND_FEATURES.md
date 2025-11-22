# Backend Features Documentation

This document provides a comprehensive overview of all backend capabilities available in the Splice expense tracking application. The backend is built on Convex and provides real-time data synchronization, AI-powered categorization, and robust expense management.

## Table of Contents

- [Database Schema](#database-schema)
- [Expense Management](#expense-management)
- [AI-Powered Categorization](#ai-powered-categorization)
- [Merchant Normalization](#merchant-normalization)
- [Heuristic Categorization](#heuristic-categorization)
- [Upload Management](#upload-management)
- [Custom Categories](#custom-categories)
- [Admin & Monitoring](#admin--monitoring)
- [Bulk Operations](#bulk-operations)

---

## Database Schema

The backend uses 5 database tables to manage expenses and categorization:

### 1. **expenses** Table
Stores all expense transactions with categorization and split tracking.

**Fields:**
- `expenseId` (string, indexed) - Unique hash ID for deduplication
- `name` (string) - Transaction description
- `amount` (number) - Transaction amount
- `date` (string) - Date in YYYY-MM-DD format
- `checked` (boolean) - User verification status
- `split` (boolean, optional) - Whether expense is split 50/50 (true) or individual 100% (false)
- `year` (number) - Year for filtering
- `month` (string) - Month in 2-digit format (01-12)
- `uploadTimestamp` (number, optional) - When expense was added (for tracking new uploads)
- `category` (string, optional) - Assigned expense category
- `merchantName` (string, optional) - Normalized merchant name (e.g., "WOOLWORTHS")

**Indexes:**
- `by_expense_id` on `expenseId`

### 2. **uploads** Table
Tracks file upload history and status.

**Fields:**
- `filename` (string) - Uploaded file name
- `size` (number) - File size in bytes
- `uploadDate` (number) - Timestamp
- `status` (string) - "success" or "error"
- `errorMessage` (string, optional) - Error details if failed

### 3. **merchantMappings** Table
Global crowd-sourced merchant-to-category mappings.

**Fields:**
- `merchantName` (string, indexed) - Normalized merchant name
- `category` (string) - Most common category for this merchant
- `confidence` (string) - "ai" | "user" | "consensus"
- `voteCount` (number) - Number of user confirmations
- `categoryVotes` (object, optional) - JSON object tracking votes per category
- `aiSuggestion` (string, optional) - Original AI suggestion
- `lastUpdated` (number) - Timestamp

**Indexes:**
- `by_merchant` on `merchantName`

### 4. **personalMappings** Table
User-specific merchant categorization overrides.

**Fields:**
- `userId` (string) - User ID (or anonymous device ID)
- `merchantName` (string) - Normalized merchant name
- `category` (string) - User's preferred category
- `createdAt` (number) - Timestamp

**Indexes:**
- `by_user_merchant` on `userId` and `merchantName`

### 5. **customCategories** Table
User-created custom expense categories.

**Fields:**
- `name` (string, indexed) - Category name
- `createdAt` (number) - Timestamp

**Indexes:**
- `by_name` on `name`

---

## Expense Management

### Core Queries

#### `getYears`
Returns all years that have expenses, sorted descending.

**Args:** None

**Returns:** `number[]` - Array of years (e.g., [2025, 2024, 2023])

---

#### `getAllExpenses`
Returns all expenses in the database (used for scanning and building mappings).

**Args:** None

**Returns:** Array of all expense records

---

#### `getExpensesByYear`
Gets expenses grouped by month for a specific year.

**Args:**
- `year` (number) - The year to query

**Returns:**
```typescript
{
  year: number
  months: Array<{
    month: string        // "01", "02", etc.
    expenses: Expense[]
    totalShare: number   // Sum of checked expenses / 2
  }>
}
```

---

#### `getMonthExpenses`
Gets all expenses for a specific month with totals.

**Args:**
- `year` (number) - Year
- `month` (string) - Month in 2-digit format ("01"-"12")

**Returns:**
```typescript
{
  year: number
  month: string
  expenses: Expense[]
  totals: {
    all: number      // Total personal spending (shared + mine)
    mine: number     // Individual 100% expenses only
    shared: number   // Your share of split 50% expenses
  }
  counts: {
    all: number      // Total expense count
    mine: number     // Count of individual expenses
    shared: number   // Count of split expenses
  }
}
```

---

#### `getYearSummary`
Gets comprehensive year summary with monthly aggregates and comparisons.

**Args:**
- `year` (number) - Year to summarize
- `sessionStartTime` (number, optional) - For tracking unseen expenses

**Returns:**
```typescript
{
  year: number
  totals: {
    all: number      // Total personal spending for year
    mine: number     // Total individual expenses
    shared: number   // Total shared expense share
  }
  averagePerMonth: number
  changeComparedToPreviousYear: {
    direction: "increase" | "decrease" | "none"
    icon: string
    color: string
  }
  months: Array<{
    month: string        // "January", "February", etc.
    monthNumber: string  // "01", "02", etc.
    totals: { all, mine, shared }
    counts: { all, mine, shared }
    showGreenDot: boolean  // Has unseen expenses
  }>
  error: null
}
```

**Features:**
- Returns all 12 months even if no data (fills with zeros)
- Calculates year-over-year comparison
- Tracks unseen expenses with green dot indicators
- Separates split vs individual expense totals

---

#### `getMonthlyTotals`
Gets monthly expense totals across all time for charting.

**Args:** None

**Returns:**
```typescript
Array<{
  year: number
  month: string
  total: number     // Personal total (split share + individual)
  label: string     // "Jan 2024", "Feb 2024", etc.
}>
```

**Use Case:** Powers the monthly expenses chart visualization

---

#### `getExpensesFeed`
Gets expenses grouped by month-year for homepage feed.

**Args:**
- `limit` (number, optional) - Number of months to return (default: 6)

**Returns:** Array of month groups with expenses, sorted newest first

---

#### `getRecentUploadBatches`
Gets recent expense uploads grouped by upload batch.

**Args:**
- `limit` (number, optional) - Number of batches to return (default: 10)

**Returns:** Array of upload batches with summary data and preview expenses

**Features:**
- Groups expenses uploaded within 5 seconds as same batch
- Provides first 3 expense names for preview
- Includes totals and counts per batch

---

#### `getMonthsGroupedByYear`
Gets all months grouped by year for navigation.

**Args:** None

**Returns:**
```typescript
Array<{
  year: number
  months: Array<{
    month: string        // "01", "02", etc.
    monthName: string    // "Jan", "Feb", etc.
    yearMonth: string    // "2024-01", "2024-02", etc.
  }>
}>
```

**Use Case:** Powers the vertical navigation month links

---

### Core Mutations

#### `addExpenses`
Adds new expenses with deduplication.

**Args:**
```typescript
{
  expenses: Array<{
    expenseId: string
    name: string
    amount: number
    date: string          // YYYY-MM-DD
    year: number
    month: string         // "01"-"12"
    checked?: boolean     // Optional, defaults to false
    split?: boolean       // Optional, defaults to false (individual)
    category?: string     // Optional category
    merchantName?: string // Optional normalized merchant
  }>
}
```

**Returns:**
```typescript
{
  addedCount: number
  duplicateCount: number
  newExpenseIds: string[]
}
```

**Features:**
- Automatic deduplication using `expenseId` index
- Sets `uploadTimestamp` for unseen tracking
- Defaults: `checked=false`, `split=false`

---

#### `toggleExpense`
Toggles the checked status of a single expense.

**Args:**
- `expenseId` (string)

**Returns:**
```typescript
{
  expenseId: string
  newCheckedStatus: boolean
  result: "success"
}
```

---

#### `toggleAllExpenses`
Toggles all expenses in a month to checked or unchecked.

**Args:**
- `year` (number)
- `month` (string)
- `checked` (boolean) - Target checked state

**Returns:**
```typescript
{
  updatedCount: number
  checked: boolean
  result: "success"
}
```

---

#### `toggleSplit`
Toggles an expense between split (50/50) and individual (100%).

**Args:**
- `expenseId` (string)

**Returns:**
```typescript
{
  expenseId: string
  newSplitStatus: boolean
  result: "success"
}
```

**Note:** Defaults to false (individual) if undefined

---

#### `deleteAllExpenses`
Deletes all expenses from the database.

**Args:** None

**Returns:**
```typescript
{
  deletedCount: number
  result: "success"
}
```

**⚠️ Warning:** Destructive operation, cannot be undone

---

#### `bulkDeleteExpenses`
Deletes specific expenses by ID.

**Args:**
- `expenseIds` (string[]) - Array of expense IDs to delete

**Returns:**
```typescript
{
  deletedCount: number
  result: "success"
}
```

---

#### `bulkSetSplit`
Sets multiple expenses as split (50/50).

**Args:**
- `expenseIds` (string[])

**Returns:**
```typescript
{
  updatedCount: number
  result: "success"
}
```

---

#### `bulkSetIndividual`
Sets multiple expenses as individual (100%).

**Args:**
- `expenseIds` (string[])

**Returns:**
```typescript
{
  updatedCount: number
  result: "success"
}
```

---

### Advanced Actions

#### `addExpensesWithKnownCategories`
**Current Recommended Method** - Fast expense upload with cache-only categorization.

**Args:**
```typescript
{
  expenses: Array<ParsedExpense>
  userId?: string
}
```

**Returns:**
```typescript
{
  addedCount: number
  duplicateCount: number
  newExpenseIds: string[]
  categorizedFromCache: number      // Merchants found in mappings
  categorizedFromHeuristics: number // Merchants categorized by keywords
  uncategorizedCount: number        // Merchants left uncategorized
  totalMerchants: number
}
```

**Features:**
- Saves ALL expenses immediately (graceful degradation)
- Checks personal mappings first (user overrides)
- Checks global mappings second (crowd-sourced)
- Uses heuristic categorization third (keyword matching)
- Leaves uncategorized expenses for manual categorization
- No AI calls = fast uploads
- No blocking on rate limits

**Workflow:**
1. Normalize merchant names
2. Save all expenses to database
3. Deduplicate merchants to reduce processing
4. Check personal mappings (highest priority)
5. Check global mappings (crowd-sourced)
6. Try heuristic categorization (keyword-based)
7. Leave remaining uncategorized

---

#### `addExpensesWithCategories` (DEPRECATED)
Legacy method that blocks uploads while calling AI for every merchant.

**Status:** Deprecated in favor of cache-based categorization

**Why Deprecated:**
- Blocks upload while categorizing
- Can hit rate limits during upload
- Slow for large uploads
- Poor user experience

**Migration:** Use `addExpensesWithKnownCategories` instead

---

#### `addExpensesWithBackgroundCategorization` (DEPRECATED)
Legacy Phase 3 method with smart auto-split prediction.

**Status:** Deprecated - functionality merged into `addExpensesWithKnownCategories`

---

#### `getMerchantSplitPattern`
Analyzes merchant's historical split pattern for smart predictions.

**Args:**
- `merchantName` (string) - Normalized merchant name
- `lookbackMonths` (number) - Usually 2
- `fromDate` (string) - YYYY-MM-DD format

**Returns:**
```typescript
{
  suggestedSplit: boolean       // Recommended split status
  confidence: "high" | "low" | "none"
  sampleSize: number            // Number of historical expenses
  splitPercentage: number       // Percentage that were split (0-1)
}
```

**Logic:**
- `>=80%` split → suggest split=true (high confidence)
- `<=20%` split → suggest split=false (high confidence)
- Mixed pattern → suggest split=true (low confidence)
- No history → default to split=true (no confidence)

---

#### `migrateSplitFromChecked`
Migration utility to infer `split` field from `checked` field.

**Args:** None

**Returns:**
```typescript
{
  message: string
  total: number
  alreadyMigrated: number
}
```

**Migration Logic:**
- `checked=true` → `split=true` (was counted as 50% shared)
- `checked=false` → `split=false` (was not counted = 100% individual)

---

## AI-Powered Categorization

The backend includes a sophisticated three-tier AI categorization system using OpenRouter + Groq (free tier).

### Supported Categories

13 predefined categories:
- Groceries
- Dining & Takeaway
- Transport
- Fuel
- Entertainment
- Shopping
- Bills & Utilities
- Health & Medical
- Home & Garden
- Education
- Travel
- Hobbies
- Other

### Three-Tier Categorization System

**Priority Order:**
1. **Personal Mappings** - User-specific overrides (highest priority)
2. **Global Mappings** - Crowd-sourced community consensus
3. **AI Categorization** - OpenRouter + Groq API (fallback)

### Core Functions

#### `categorizeMerchantWithAI` (Action)
Calls OpenRouter API to categorize a merchant using AI.

**Args:**
- `merchantName` (string) - Normalized merchant name
- `description` (string) - Transaction description for context

**Returns:** `string` - Category name or "Other" as fallback

**Features:**
- Uses `meta-llama/llama-3.2-3b-instruct:free` model (free via Groq)
- Temperature: 0.3 for consistent results
- Max tokens: 20 (only need category name)
- Graceful error handling with fallback to "Other"
- Rate limit detection and error propagation
- Fuzzy category matching for AI responses

**Error Handling:**
- Missing API key → fallback to "Other"
- Rate limit (429) → throws `RATE_LIMIT` error for upstream handling
- Other HTTP errors → fallback to "Other"
- Invalid category response → fuzzy match or fallback to "Other"

---

#### `categorizeMerchantWithRetry` (Internal Action)
AI categorization with exponential backoff retry logic.

**Args:**
- `merchantName` (string)
- `description` (string)
- `maxRetries` (number, optional) - Default: 3

**Returns:**
```typescript
{
  category: string
  attempts: number
  finalAttemptSucceeded: boolean
  retryDelays: number[]  // Actual delays used
}
```

**Retry Strategy:**
- Exponential backoff: 1s, 2s, 4s, 8s, etc. (max 30s)
- Only retries on rate limit errors
- Non-rate-limit errors fail immediately
- Returns "Other" if all retries exhausted

---

#### `getCategoryForMerchant` (Action)
Main categorization flow with three-tier lookup and optional retry.

**Args:**
- `merchantName` (string)
- `description` (string)
- `userId` (string, optional)
- `enableRetry` (boolean, optional) - Default: false
- `maxRetries` (number, optional) - Default: 3

**Returns:**
```typescript
{
  category: string
  source: "personal" | "global" | "ai" | "ai-retry"
  attempts?: number        // Only for AI categorization
  retryDelays?: number[]   // Only for AI with retries
}
```

**Workflow:**
1. Check personal mapping (user override)
2. Check global mapping (crowd-sourced)
3. Call AI (with or without retry based on `enableRetry`)
4. Store AI result in global mapping for future use

**Use Cases:**
- `enableRetry=false` - Fast categorization, fail on rate limit (for backfill)
- `enableRetry=true` - Robust categorization with retry (for upload flow)

---

#### `updateExpenseCategoryWithMapping` (Action)
Updates expense category with user feedback and creates mappings.

**Args:**
- `expenseId` (string)
- `merchantName` (string)
- `category` (string)
- `userId` (string, optional)
- `updateAllFromMerchant` (boolean, optional) - Create personal override

**Returns:** `{ success: true }`

**Workflow:**
1. Update the expense's category
2. If `updateAllFromMerchant=true` → create personal mapping
3. Vote on global mapping (consensus building)

**Use Case:** User corrects a category → system learns preference

---

#### `categorizeExistingExpenses` (Action)
Backfills categories for all uncategorized expenses using AI.

**Args:**
- `userId` (string, optional)
- `delayMs` (number, optional) - Delay between API calls (default: 4000ms)

**Returns:**
```typescript
{
  totalExpenses: number
  alreadyCategorized: number
  newlyCategorized: number
  errors: number
  rateLimitResetTime?: number  // If rate limited
}
```

**Features:**
- Skips already categorized expenses
- Normalizes merchant names
- Uses three-tier categorization
- Respects rate limits with delays
- Returns early if rate limited
- No retry logic (to avoid long delays)

**Use Case:** Admin workflow to categorize historical data

---

#### `populateMerchantMappingsFromExpenses` (Internal Action)
Scans all categorized expenses to build/update global merchant mappings.

**Args:** None

**Returns:**
```typescript
{
  processedMerchants: number
  createdMappings: number
  updatedMappings: number
  skippedMerchants: number
}
```

**Features:**
- Groups expenses by merchant
- Counts category votes per merchant
- Creates/updates global mappings with vote data
- Sets confidence to "consensus"
- Stores `categoryVotes` object for transparency

**Use Case:** Rebuild merchant mappings from historical data

---

#### `runFullCategorizationWorkflow` (Action)
Unified admin workflow combining categorization + mapping rebuild.

**Args:** None

**Returns:**
```typescript
{
  success: boolean
  phase1: {
    totalExpenses: number
    alreadyCategorized: number
    newlyCategorized: number
    errors: number
  }
  phase2: {
    processedMerchants: number
    created: number
    updated: number
    skipped: number
  }
  summary: {
    totalCategorized: number
    merchantsMapped: number
  }
}
```

**Workflow:**
1. **Phase 1:** Categorize all uncategorized expenses using AI
2. **Phase 2:** Rebuild merchant mappings from categorized expenses

**Use Case:** Single-button admin operation to optimize system

---

### Mapping Queries

#### `getGlobalMapping`
Gets global merchant-to-category mapping.

**Args:**
- `merchantName` (string)

**Returns:** Mapping object or null

---

#### `getPersonalMapping`
Gets user's personal merchant override.

**Args:**
- `userId` (string)
- `merchantName` (string)

**Returns:** Personal mapping or null

---

### Mapping Mutations (Internal)

#### `upsertGlobalMapping`
Creates or updates global merchant mapping.

**Args:**
- `merchantName` (string)
- `category` (string)
- `confidence` (string) - "ai" | "user" | "consensus"
- `aiSuggestion` (string, optional)

---

#### `upsertPersonalMapping`
Creates or updates personal merchant mapping.

**Args:**
- `userId` (string)
- `merchantName` (string)
- `category` (string)

---

#### `voteForCategory`
Records a vote for a category on global mapping.

**Args:**
- `merchantName` (string)
- `category` (string)

**Features:**
- Creates mapping if doesn't exist
- Increments vote count
- Updates category to latest user choice
- Sets confidence to "user"

---

## Merchant Normalization

The backend includes robust merchant name normalization to improve categorization accuracy.

### `normalizeMerchant` Function
Extracts core merchant name from transaction descriptions.

**Examples:**
- "WOOLWORTHS TOWN HALL 123" → "WOOLWORTHS"
- "BP NORTHSIDE" → "BP"
- "NETFLIX.COM" → "NETFLIX"

**Logic:**
1. Convert to uppercase and trim
2. Remove domain suffixes (.com, .com.au, .net, .org)
3. Remove trailing numbers (location codes, transaction IDs)
4. Remove common suffixes (STORE, BRANCH, PTY LTD, etc.)
5. Check against known merchant database (80+ merchants)
6. Return first significant word(s)

**Known Merchants Database:** 80+ Australian merchants including:
- Grocery: WOOLWORTHS, COLES, ALDI, IGA
- Retail: KMART, TARGET, BIG W, MYER, DAVID JONES
- Electronics: JB HI-FI, HARVEY NORMAN, OFFICEWORKS
- Pharmacy: CHEMIST WAREHOUSE, PRICELINE
- Liquor: DAN MURPHY, BWS, LIQUORLAND
- Fuel: CALTEX, BP, SHELL, 7-ELEVEN, MOBIL, AMPOL
- Streaming: NETFLIX, SPOTIFY, APPLE
- Food Delivery: UBER, DELIVEROO, MENULOG, DOORDASH
- Telco: TELSTRA, OPTUS, VODAFONE
- Banks: COMMONWEALTH BANK, WESTPAC, ANZ, NAB
- Entertainment: CINEWORLD, EVENT CINEMAS, HOYTS, VILLAGE CINEMAS
- Fast Food: MCDONALD, KFC, HUNGRY JACK, SUBWAY, DOMINO, PIZZA HUT

**Use Cases:**
- Deduplication of merchants across different locations
- Improved categorization accuracy
- Better merchant mapping lookups

---

### `calculateCutoffDate` Function
Calculates date N months ago for historical pattern analysis.

**Args:**
- `fromDate` (string) - YYYY-MM-DD format
- `monthsBack` (number)

**Returns:** Date string in YYYY-MM-DD format

**Examples:**
- `calculateCutoffDate("2024-03-15", 2)` → "2024-01-15"
- `calculateCutoffDate("2024-01-31", 2)` → "2023-11-30" (handles month end)

---

## Heuristic Categorization

The backend includes keyword-based heuristic categorization to reduce AI API calls and work offline.

### `categorizeByHeuristics` Function
Categorizes expenses using keyword matching (no AI required).

**Args:**
- `merchantName` (string) - Normalized merchant name
- `description` (string) - Full expense description

**Returns:** Category name or null if no match

**Scoring System:**
- Exact merchant name match: +100 points
- Merchant name contains keyword: +50 points
- Description contains keyword: +10 points
- Returns category with highest score

**Keyword Coverage:**
- 13 categories
- 200+ keywords total
- Focused on Australian merchants and patterns

**Benefits:**
- Instant categorization (no API call)
- Works offline
- No rate limits
- Zero cost
- Common merchants handled automatically

---

### `isCommonMerchant` Function
Checks if merchant is likely categorizable by heuristics.

**Args:**
- `merchantName` (string)

**Returns:** boolean

**Use Case:** Decide whether to attempt AI categorization or use heuristics first

---

### `getHeuristicStats` Function
Gets statistics about heuristic keyword coverage.

**Returns:**
```typescript
{
  categoryCount: number
  totalKeywords: number
  keywordsPerCategory: Record<string, number>
}
```

**Use Case:** Monitoring and optimization of keyword database

---

## Upload Management

### Queries

#### `getUploads`
Gets recent upload history.

**Args:** None

**Returns:** Last 50 uploads, sorted by date descending

---

### Mutations

#### `recordUpload`
Records upload metadata.

**Args:**
- `filename` (string)
- `size` (number)
- `status` (string) - "success" or "error"
- `errorMessage` (string, optional)

**Returns:** Upload ID

**Features:**
- Automatically sets `uploadDate` timestamp
- Tracks both successful and failed uploads

---

## Custom Categories

### Queries

#### `getAllCustomCategories`
Gets all user-created custom categories.

**Args:** None

**Returns:** `string[]` - Array of category names

---

#### `getUsedCategories`
Gets all categories actually used in expenses (default + custom).

**Args:** None

**Returns:** `string[]` - Sorted array of unique categories

**Use Case:** Populate category dropdowns with only relevant options

---

### Mutations

#### `addCustomCategory`
Creates a new custom category.

**Args:**
- `name` (string) - Category name

**Returns:** Category name

**Validation:**
- Trims whitespace
- Rejects empty names
- Prevents duplicates (case-insensitive)
- Prevents names matching default categories

**Errors:**
- "Category name cannot be empty"
- "Category '...' already exists"
- "'...' is already a default category"

---

## Admin & Monitoring

### Queries

#### `getAdminDashboardStats`
Gets comprehensive admin dashboard statistics.

**Args:** None

**Returns:**
```typescript
{
  expenses: {
    uncategorized: number
    total: number
    percentage: number  // Categorization completion %
  }
  recentActivity: Array<{
    merchantName: string
    category: string
    date: string
  }>
  needsAttention: boolean  // True if uncategorized > 0
}
```

**Use Case:** Admin dashboard overview

---

#### `getUncategorizedFromUpload`
Checks for uncategorized expenses from specific upload.

**Args:**
- `uploadTimestamp` (number)

**Returns:**
```typescript
{
  count: number
  hasUncategorized: boolean
}
```

**Use Case:** Trigger toast notification after file upload

---

#### `getUncategorizedExpensesByMerchant`
Gets all uncategorized expenses grouped by merchant.

**Args:** None

**Returns:**
```typescript
{
  totalUncategorized: number
  uniqueMerchants: number
  groups: Array<{
    merchantName: string
    expenseCount: number
    totalAmount: number
    expenses: Array<{
      _id: string
      expenseId: string
      name: string
      amount: number
      date: string
    }>
  }>
}
```

**Features:**
- Groups by normalized merchant name
- Sorts by expense count (descending)
- Expenses sorted by date (newest first)

**Use Case:** Admin page showing expenses needing manual categorization

---

## Bulk Operations

### Expense Bulk Operations

All bulk operations return:
```typescript
{
  updatedCount: number  // or deletedCount for delete
  result: "success"
}
```

- **`bulkDeleteExpenses`** - Delete multiple expenses by ID
- **`bulkSetSplit`** - Set multiple expenses as split (50/50)
- **`bulkSetIndividual`** - Set multiple expenses as individual (100%)

---

## API Integration Details

### OpenRouter Integration

**Endpoint:** `https://openrouter.ai/api/v1/chat/completions`

**Model:** `meta-llama/llama-3.2-3b-instruct:free` (Free Groq model)

**Configuration:**
- Temperature: 0.3 (consistent categorization)
- Max tokens: 20 (category name only)
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer ${OPENROUTER_API_KEY}`
  - `HTTP-Referer: https://splice-app.netlify.app`
  - `X-Title: Splice Expense Tracker`

**Rate Limits:**
- 16 requests/minute (actual limit)
- 15 requests/minute (safe limit used in code)

**Environment Variables:**
- `OPENROUTER_API_KEY` - Required for AI categorization

---

## Best Practices

### For Frontend Developers

1. **Use `addExpensesWithKnownCategories` for uploads** - Fast, non-blocking, graceful degradation
2. **Check for uncategorized expenses** - Use `getUncategorizedFromUpload` to notify users
3. **Display split vs individual totals** - Users need both metrics
4. **Track unseen expenses** - Pass `sessionStartTime` to `getYearSummary`
5. **Use merchant normalization** - Import from `convex/utils.ts`

### For Admin Operations

1. **Run categorization during off-peak hours** - Respect rate limits
2. **Use `runFullCategorizationWorkflow`** - Single button for optimization
3. **Review uncategorized merchants** - Use `getUncategorizedExpensesByMerchant`

### For Categorization

1. **Personal mappings override everything** - User preferences are highest priority
2. **Build global mappings from data** - Run `populateMerchantMappingsFromExpenses`
3. **Use heuristics first** - Faster and free for common merchants
4. **AI is fallback** - Only when cache and heuristics fail
5. **Store AI results** - Save to global mappings for future use

---

## Migration Utilities

### `migrateSplitFromChecked`
One-time migration to infer `split` field from legacy `checked` field.

**Use Case:** Upgrading from version without split tracking

**Logic:**
- `checked=true` expenses were counted as 50% → `split=true`
- `checked=false` expenses were not counted → `split=false`

---

## Performance Considerations

### Database Indexes

Ensure these indexes are used for optimal performance:
- `expenses.by_expense_id` - Deduplication and lookups
- `merchantMappings.by_merchant` - Category lookups
- `personalMappings.by_user_merchant` - User override lookups
- `customCategories.by_name` - Duplicate prevention

### Optimization Tips

1. **Deduplicate merchants before categorization** - Reduces API calls
2. **Use batch operations** - `toggleAllExpenses`, `bulkSetSplit`, etc.
3. **Cache merchant mappings** - Check cache before AI
4. **Respect rate limits** - Use delay between API calls

---

## Error Handling

### Common Errors

**"Expense not found"**
- Cause: Invalid `expenseId`
- Solution: Verify expense exists before operations

**"RATE_LIMIT" or "RATE_LIMIT:{timestamp}"**
- Cause: Hit OpenRouter rate limit
- Solution: Wait for reset or use exponential backoff

**"Category name cannot be empty"**
- Cause: Empty custom category name
- Solution: Validate input before submission

**"Category '...' already exists"**
- Cause: Duplicate custom category
- Solution: Check existing categories first

**"OPENROUTER_API_KEY not set"**
- Cause: Missing API key environment variable
- Solution: Set in Convex dashboard, fallback to "Other"

---

## Future Enhancements

### Planned Features

1. **Smart split prediction** - ML-based split status inference
2. **Category analytics** - Spending trends by category
3. **Merchant search** - Find expenses by merchant
4. **Export functionality** - CSV/PDF export of expenses
5. **Budget tracking** - Category-based budgets and alerts
6. **Receipt OCR** - Extract expenses from receipt photos
7. **Multi-currency** - Support for international expenses

---

## Version History

**Current Version:** v1.0.0

**Recent Changes:**
- Added heuristic categorization
- Split vs individual expense tracking
- Custom category support
- Three-tier categorization system
- Merchant normalization (80+ merchants)
- Upload batch tracking
- Unseen expense indicators

---

## Support & Documentation

For more information, see:
- `CLAUDE.md` - Full project documentation
- `README.md` - Project overview
- `convex/schema.ts` - Database schema definitions
- `convex/expenses.ts` - Expense management functions
- `convex/categorization.ts` - AI categorization logic
- `convex/utils.ts` - Merchant normalization

---

**Last Updated:** 2025-11-22
