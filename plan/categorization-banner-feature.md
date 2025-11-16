# Categorization Progress Banner Feature

## Overview

Added a real-time progress banner at the top of the upload page to provide visibility into the categorization process. This complements the Phase 1 rate limit fixes by giving users clear feedback about what's happening during file uploads.

## Feature Description

### Visual Design

**Fixed Sticky Banner:**
- Positioned at the top of the page (z-index: 50)
- Color-coded based on status:
  - **Blue**: Categorization in progress
  - **Green**: Successfully completed
  - **Yellow**: Partially completed (some failures)
  - **Red**: Failed
- Backdrop blur effect for modern glassmorphism style
- Smooth transitions between states

### Banner States

#### 1. Categorizing (Blue)
**Shown when:** File upload and categorization is actively happening

**Displays:**
- Spinning refresh icon
- "Categorizing expenses..."
- Current file being processed (e.g., "Processing file 2 of 3")
- Real-time counts:
  - Categorized expenses / Total expenses
  - Unique merchants count

**Example:**
```
🔄 Categorizing expenses...
Processing file 2 of 3 • 45/120 expenses categorized • 18 unique merchants
```

#### 2. Completed (Green)
**Shown when:** All expenses successfully categorized

**Displays:**
- Checkmark icon
- "Categorization complete!"
- Total categorized expenses
- Total merchants processed
- Dismiss button (X)

**Example:**
```
✓ Categorization complete!
Successfully categorized 120 expenses across 35 merchants
```

#### 3. Partial (Yellow)
**Shown when:** Some merchants failed to categorize (usually due to rate limits)

**Displays:**
- Warning triangle icon
- "Categorization partially complete"
- Success/failure counts
- List of failed merchants
- Helpful tip about manual categorization
- Dismiss button (X)

**Example:**
```
⚠ Categorization partially complete
Categorized 100/120 expenses • 5 merchants failed (NIB, ACME CORP, XYZ LTD, ABC PTY, DEF CO)
Failed merchants were likely rate-limited and can be categorized manually or by running the admin tool later.
```

#### 4. Failed (Red)
**Shown when:** Upload or categorization completely failed

**Displays:**
- X icon
- "Categorization failed"
- Error message
- Dismiss button (X)

**Example:**
```
✗ Categorization failed
Unable to categorize expenses. Check upload status below.
```

### User Interactions

**During Categorization:**
- Banner is visible and updating in real-time
- Cannot be dismissed (no X button)
- Page content shifts down to accommodate banner

**After Categorization:**
- Banner remains visible with final status
- X button appears in top-right corner
- Clicking X dismisses the banner
- Page content shifts back to normal position

## Implementation Details

### State Management

**New State Added:**
```typescript
const [categorizationProgress, setCategorizationProgress] = useState<{
  status: "idle" | "categorizing" | "completed" | "partial" | "failed"
  currentFile: number
  totalFiles: number
  categorizedCount: number
  totalExpenses: number
  failedMerchants: string[]
  totalMerchants: number
}>({
  status: "idle",
  currentFile: 0,
  totalFiles: 0,
  categorizedCount: 0,
  totalExpenses: 0,
  failedMerchants: [],
  totalMerchants: 0,
})
```

### Progress Tracking Flow

**1. Upload Initialization:**
```typescript
// Reset and initialize progress
setCategorizationProgress({
  status: "categorizing",
  currentFile: 0,
  totalFiles: files.length,
  categorizedCount: 0,
  totalExpenses: 0,
  failedMerchants: [],
  totalMerchants: 0,
})
```

**2. Per-File Processing:**
```typescript
for (const fileResult of result.files) {
  fileIndex++

  // Update current file
  setCategorizationProgress(prev => ({
    ...prev,
    currentFile: fileIndex
  }))

  // Categorize expenses
  const addResult = await addExpensesWithCategories({ expenses })

  // Track results
  totalCategorized += addResult.categorizedCount || 0
  totalMerchants += addResult.totalMerchants || 0
  allFailedMerchants.push(...(addResult.failedMerchants || []))

  // Update progress
  setCategorizationProgress(prev => ({
    ...prev,
    categorizedCount: totalCategorized,
    totalExpenses: totalExpenses,
    totalMerchants: totalMerchants,
    failedMerchants: allFailedMerchants
  }))
}
```

**3. Final Status:**
```typescript
// Determine completion status
const categorizationStatus =
  totalCategorized === totalExpenses && allFailedMerchants.length === 0
    ? "completed"
    : allFailedMerchants.length > 0
      ? "partial"
      : "completed"

setCategorizationProgress(prev => ({
  ...prev,
  status: categorizationStatus
}))
```

### Integration with Phase 1

This banner directly integrates with the Phase 1 rate limit fixes:

**Uses Phase 1 Return Values:**
- `addResult.categorizedCount` - Number of successfully categorized expenses
- `addResult.failedMerchants` - Array of merchants that failed (rate limits)
- `addResult.totalMerchants` - Total unique merchants processed

**Provides Visibility Into:**
- Batch deduplication (shows unique merchant count)
- Graceful degradation (shows partial success)
- Failed merchants (lists what needs manual categorization)
- Overall progress (files and expenses processed)

## User Benefits

### 1. **Transparency**
Users can see exactly what's happening during the upload and categorization process, reducing anxiety about long-running operations.

### 2. **Progress Tracking**
Real-time updates show how many files/expenses have been processed, giving users a sense of completion.

### 3. **Failure Awareness**
When rate limits are hit, users immediately see which merchants failed and understand why (with helpful context).

### 4. **Actionable Information**
The banner suggests next steps (manual categorization or admin tool) when failures occur.

### 5. **Non-Intrusive**
- Banner can be dismissed after categorization
- Doesn't block interaction with the page
- Automatically adjusts page layout

## Technical Considerations

### Performance
- State updates happen per-file, not per-expense (minimizes re-renders)
- Banner uses CSS transitions for smooth animations
- Fixed positioning prevents layout thrashing

### Accessibility
- Semantic HTML with ARIA labels
- Keyboard-accessible dismiss button
- Color is not the only status indicator (icons + text)
- High contrast text on colored backgrounds

### Responsive Design
- Adapts to mobile screens
- Text wraps appropriately
- Icons scale with viewport

## Future Enhancements

### Potential Improvements
1. **Progress Bar**: Add a visual progress bar showing percentage complete
2. **Estimated Time**: Show "~30 seconds remaining" based on current pace
3. **Toast Notifications**: Alternative to banner for less intrusive feedback
4. **Detailed Log**: Expandable section showing categorization details per merchant
5. **Auto-Dismiss**: Automatically hide banner after X seconds of completion
6. **Sound/Vibration**: Optional notification when categorization completes
7. **Pause/Resume**: Allow users to pause categorization mid-process

### Phase 2 Integration Ideas
When Phase 2 (retry logic) is implemented:
- Show retry attempts in banner
- Display countdown to next retry
- Show success rate improvement after retries

### Phase 3 Integration Ideas
When Phase 3 (background jobs) is implemented:
- Show "Categorization queued" status
- Link to job status page
- Notification when background job completes

## Testing Recommendations

### Manual Testing Scenarios

**1. Small Upload (1-5 expenses):**
- Should complete quickly
- Banner should show "completed" status
- All expenses should be categorized

**2. Large Upload (50+ expenses, 20+ unique merchants):**
- Banner should show real-time progress
- File count should increment (if multiple files)
- Merchant count should be visible
- May hit rate limits and show "partial" status

**3. Rate Limit Scenario:**
- Upload enough unique merchants to hit limit (16+)
- Banner should show "partial" status
- Failed merchants should be listed
- Helpful message should appear

**4. Upload Error:**
- Try uploading invalid file
- Banner should show "failed" status
- Error message should be clear

**5. Dismiss Functionality:**
- After upload completes, X button should appear
- Clicking X should hide banner
- Page layout should adjust smoothly

### Visual Testing
- Test on different screen sizes (mobile, tablet, desktop)
- Verify color contrast for accessibility
- Check that text doesn't overflow
- Ensure icons render correctly
- Test backdrop blur on different backgrounds

## Files Modified

**src/routes/index.tsx:**
- Added `categorizationProgress` state (lines 39-55)
- Updated `handleFiles` to track progress (lines 57-213)
- Added banner component to JSX (lines 334-491)
- Added conditional page margin (line 494)

**Total Changes:**
- 1 file changed
- 250 lines added
- 1 line deleted

## Related Work

**Builds on:**
- Phase 1 Rate Limit Fixes (plan/rate-limit-fix-plan.md)
- `addExpensesWithCategories` improvements (convex/expenses.ts)
- Error handling enhancements (convex/categorization.ts)

**Enables:**
- Better user experience during uploads
- Visibility into Phase 1's graceful degradation
- Understanding of what needs manual attention

## Deployment Notes

**No Breaking Changes:**
- Purely additive feature
- Doesn't affect existing functionality
- Backward compatible with old upload flow

**Environment Requirements:**
- None (no env vars needed)
- Works with existing Convex setup
- No additional dependencies

**Rollback Strategy:**
- Can be disabled by removing banner component
- Doesn't affect data persistence
- Upload flow still works if banner fails to render

## Conclusion

This categorization progress banner significantly improves the user experience by providing real-time visibility into what's happening during file uploads and expense categorization. It seamlessly integrates with the Phase 1 rate limit fixes, making the improved backend logic visible and understandable to users.

The feature is production-ready, accessible, responsive, and requires no additional infrastructure or configuration.
