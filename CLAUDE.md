# CLAUDE.md - AI Assistant Development Guide

This file provides comprehensive guidance for AI assistants working on the Splice codebase.

## Project Overview

**Splice** is a full-stack React expense tracking application built with TanStack Start, featuring server-side rendering, type-safe server functions, and modern React patterns. The application allows users to upload bank statements (PDF format), automatically parse transactions, and track expenses by year and month. It showcases TanStack ecosystem integration including Router, Query, Form, and Convex backend for real-time data synchronization.

### Tech Stack

- **Framework**: TanStack Start 1.136.4 (full-stack React framework)
- **Runtime**: React 19.2.0
- **Language**: TypeScript 5.9.3
- **Build Tool**: Vite 7.2.2
- **Routing**: TanStack Router 1.136.4 (file-based)
- **Data Fetching**: TanStack Query 5.90.9
- **Forms**: TanStack Form 1.25.0
- **Backend**: Convex 1.29.1
- **Styling**: Tailwind CSS 4.1.17
- **UI Components**: Shadcn/UI (Radix UI primitives)
- **Icons**: Lucide React 0.553.0
- **Linting/Formatting**: Biome 2.3.5
- **Testing**: Vitest 4.0.9
- **Validation**: Zod 4.1.12
- **PDF Parsing**: pdf-parse 2.4.5
- **CSV Parsing**: papaparse 5.5.3
- **Utilities**: clsx 2.1.1, tailwind-merge 3.4.0, class-variance-authority 0.7.1
- **Animations**: tw-animate-css 1.4.0
- **Deployment**: Netlify
- **Package Manager**: pnpm

### Additional Dev Dependencies

- **Types**: @types/node 24.10.1, @types/pdf-parse 1.1.5, @types/papaparse 5.5.0, @types/react 19.2.5, @types/react-dom 19.2.3
- **Performance**: web-vitals 5.1.0
- **AI/ML**: OpenRouter API (via Groq) for expense categorization

## Directory Structure

**Quick Stats:**
- 5 Routes (1 API, 3 pages, 1 layout)
- 7 UI Components (Shadcn/UI)
- 5 Utility Libraries (parsers, helpers, categories)
- 3 Convex Functions (expenses, categorization, utils)
- 4 Database Tables (expenses, uploads, merchantMappings, personalMappings)

**Full Directory Tree:**

```
/home/gyfchong/Code/splice/
├── .claude/                   # Claude Code configuration
│   └── settings.local.json
├── .netlify/                  # Netlify build artifacts (gitignored)
├── .tanstack/                 # TanStack build cache (gitignored)
├── .vscode/                   # VS Code settings
│   └── settings.json
├── convex/                    # Backend code (Convex)
│   ├── _generated/           # Auto-generated Convex files (DO NOT EDIT)
│   │   ├── api.d.ts         # API type definitions
│   │   ├── dataModel.d.ts   # Data model types
│   │   └── server.d.ts      # Server function types
│   ├── categorization.ts     # AI-powered expense categorization logic
│   ├── expenses.ts           # Expense queries, mutations, and actions
│   ├── schema.ts             # Database schema definitions (4 tables)
│   ├── utils.ts              # Merchant normalization utilities (80+ merchants)
│   └── tsconfig.json         # TypeScript config for Convex
├── node_modules/              # Dependencies (gitignored)
├── public/                    # Static assets (served at root)
│   ├── favicon.ico           # Site favicon
│   ├── logo.svg              # App logo (TanStack)
│   ├── logo192.png           # PWA icon (192x192)
│   ├── logo512.png           # PWA icon (512x512)
│   ├── manifest.json         # PWA manifest
│   ├── robots.txt            # SEO robots file
│   ├── styles.css            # Global Tailwind CSS
│   ├── tanstack-circle-logo.png
│   └── tanstack-word-logo-white.svg
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # Shadcn UI primitives (Radix-based)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── switch.tsx
│   │   │   └── textarea.tsx
│   │   └── Header.tsx       # Main navigation header
│   ├── data/                # Static data/constants (currently empty)
│   ├── integrations/        # Third-party service integrations
│   │   ├── convex/
│   │   │   └── provider.tsx # Convex provider wrapper
│   │   └── tanstack-query/
│   │       ├── devtools.tsx # React Query devtools
│   │       └── root-provider.tsx # Query client setup
│   ├── lib/                 # Utility functions and parsers
│   │   ├── categories.ts    # Expense category definitions (13 categories)
│   │   ├── csv-parser.ts    # CSV expense parser (Google Sheets, NAB exports)
│   │   ├── normalize-merchant.ts # Client-side merchant normalization
│   │   ├── pdf-parser.ts    # PDF bank statement parser (NAB format)
│   │   └── utils.ts         # cn() helper for Tailwind class merging
│   ├── routes/              # File-based routes (TanStack Router)
│   │   ├── m/               # Compact month view routes
│   │   │   └── $yearMonth.tsx # /m/2024-01 (dynamic yearMonth param)
│   │   ├── $year.tsx        # /$year - Year summary with aggregates
│   │   ├── __root.tsx       # Root layout (providers, header, devtools)
│   │   ├── api.upload.ts    # POST /api/upload - Multi-file upload handler
│   │   └── index.tsx        # / - Home page with file upload
│   ├── router.tsx           # Router configuration
│   └── routeTree.gen.ts     # Auto-generated route tree (DO NOT EDIT)
├── .cursorrules              # Cursor IDE rules
├── .cta.json                 # CTA configuration
├── .env.local                # Local environment variables (gitignored)
├── .gitignore                # Git ignore rules
├── biome.json                # Biome formatter/linter configuration
├── CLAUDE.md                 # AI assistant development guide (THIS FILE)
├── components.json           # Shadcn/UI configuration
├── LICENSE                   # Project license
├── netlify.toml              # Netlify deployment configuration
├── package.json              # Dependencies and scripts
├── pnpm-lock.yaml            # pnpm lockfile
├── README.md                 # Project README
├── tsconfig.json             # TypeScript configuration
└── vite.config.ts            # Vite build configuration
```

## Code Style & Conventions

### Formatting Rules (Biome)

- **Indentation**: TABS (not spaces) - enforced by biome.json:21
- **Quotes**: Double quotes for JavaScript/TypeScript - biome.json:32
- **Import Organization**: Auto-organized imports enabled - biome.json:23
- **Formatter**: Biome (not Prettier)
- **File Includes**: Configured to format src/, .vscode/, index.html, and vite.config.js

### TypeScript Configuration

- **Module Resolution**: Bundler mode (tsconfig.json:11)
- **Strict Mode**: Enabled (tsconfig.json:18)
- **JSX**: react-jsx (tsconfig.json:5)
- **Target**: ES2022 (tsconfig.json:4)
- **Path Aliases**: `@/*` maps to `./src/*` (tsconfig.json:24-26)

### Naming Conventions

- **Components**: PascalCase (e.g., `Header.tsx`)
- **Utilities**: kebab-case (e.g., `pdf-parser.ts`, `utils.ts`)
- **Routes**: kebab-case or dynamic parameters with $ prefix (e.g., `$year.tsx`)
- **API Routes**: Prefix with `api.` (e.g., `api.upload.ts`)

### File Organization

1. **Routes** go in `src/routes/` (file-based routing)
   - API routes: Prefix with `api.` (e.g., `api.upload.ts`)
   - Dynamic routes: Use `$` prefix for parameters (e.g., `$year.tsx`, `$yearMonth.tsx`)
   - Nested routes: Use subdirectories (e.g., `m/$yearMonth.tsx` → `/m/2024-01`)
   - Root layout: `__root.tsx` wraps all routes

2. **Reusable components** in `src/components/`
   - `Header.tsx` - Main navigation component
   - Future components go here

3. **UI primitives** in `src/components/ui/` (Shadcn components)
   - All installed via `pnpx shadcn@latest add [component]`
   - Built on Radix UI primitives
   - 7 components currently: button, input, label, select, slider, switch, textarea

4. **Utilities** in `src/lib/`
   - `utils.ts` - Tailwind cn() helper for class merging
   - `pdf-parser.ts` - Bank statement PDF parsing (NAB format)
   - `csv-parser.ts` - CSV expense parsing (Google Sheets, NAB exports)
   - `categories.ts` - Expense category definitions (13 categories)
   - `normalize-merchant.ts` - Client-side merchant normalization

5. **Integration wrappers** in `src/integrations/`
   - `convex/provider.tsx` - Convex backend provider
   - `tanstack-query/root-provider.tsx` - React Query client setup
   - `tanstack-query/devtools.tsx` - React Query devtools

6. **Static assets** in `public/` (served at root path)
   - `styles.css` - Global Tailwind CSS (imported in __root.tsx)
   - `manifest.json` - PWA manifest
   - `favicon.ico`, `logo192.png`, `logo512.png` - Icons
   - `logo.svg` - TanStack logo
   - `robots.txt` - SEO robots file

7. **Convex backend** in `convex/` (separate from src/)
   - `schema.ts` - Database schema (4 tables: expenses, uploads, merchantMappings, personalMappings)
   - `expenses.ts` - Expense queries, mutations, and actions
   - `categorization.ts` - AI categorization logic (OpenRouter + Groq)
   - `utils.ts` - Server-side merchant normalization (80+ known merchants)
   - `_generated/` - Auto-generated types (DO NOT EDIT)

8. **Configuration files** (root directory)
   - `vite.config.ts` - Vite build config with TanStack Start plugin
   - `tsconfig.json` - TypeScript config with path aliases
   - `biome.json` - Formatter/linter config (tabs, double quotes)
   - `components.json` - Shadcn/UI config
   - `netlify.toml` - Netlify deployment config
   - `package.json` - Dependencies and scripts
   - `.env.local` - Local environment variables (gitignored)

## Routing System

### File-Based Routing (TanStack Router)

Routes are automatically generated from files in `src/routes/`:

- `index.tsx` → `/` (home page with PDF/CSV upload)
- `$year.tsx` → `/2024` (year summary with monthly aggregates and comparisons)
- `m/$yearMonth.tsx` → `/m/2024-01` (compact month view)
- `api.upload.ts` → `/api/upload` (POST endpoint for multi-file upload)
- `__root.tsx` → Layout wrapper for all routes (providers, header, devtools)

### Route File Structure

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/path')({
  component: ComponentName,
  // Optional:
  loader: async () => { /* fetch data */ },
  beforeLoad: async () => { /* auth check */ },
  errorComponent: ErrorComponent,
})

function ComponentName() {
  // Use loader data: const data = Route.useLoaderData()
  return <div>Content</div>
}
```

### Root Route Layout

Located at `src/routes/__root.tsx` (lines 48-75):
- Wraps all routes with `<Outlet />`
- Includes global providers (ConvexProvider)
- Contains Header component
- Includes devtools (Router, Query)
- Defines meta tags and links in `head()` function

### Navigation

Use `<Link>` component from TanStack Router:

```typescript
import { Link } from '@tanstack/react-router'

// Home page
<Link to="/">Home</Link>

// Year summary
<Link to="/$year" params={{ year: '2024' }}>
  2024 Summary
</Link>

// Compact month view
<Link to="/m/$yearMonth" params={{ yearMonth: '2024-01' }}>
  Jan 2024
</Link>

// With active styling
<Link
  to="/$year"
  params={{ year: '2024' }}
  activeProps={{ className: 'text-cyan-400' }}
>
  2024
</Link>
```

**Route Parameters:**
- `$year` - 4-digit year string (e.g., "2024", "2025")
- `$yearMonth` - Combined year-month format (e.g., "2024-01", "2025-12")

See `src/components/Header.tsx` for navigation examples.

## Data Fetching Patterns

### TanStack Query Integration

Query client is configured in `src/integrations/tanstack-query/root-provider.tsx` and integrated with Router SSR.

**Usage Example:**

```typescript
import { useQuery } from '@tanstack/react-query'

const { data, isLoading } = useQuery({
  queryKey: ['items'],
  queryFn: async () => {
    const res = await fetch('/api/items')
    return res.json()
  },
})
```

### Route Loaders

Preferred for SSR data fetching:

```typescript
export const Route = createFileRoute('/products')({
  loader: async () => {
    const response = await fetch('/api/products')
    return response.json()
  },
  component: Products,
})

function Products() {
  const data = Route.useLoaderData()
  return <div>{/* render data */}</div>
}
```

### Convex Integration

Convex is configured for real-time backend. Provider is in `src/integrations/convex/provider.tsx`.

**Schema** (convex/schema.ts):
- `expenses`:
  - `expenseId` (string) - Unique ID for deduplication
  - `name` (string) - Expense description
  - `amount` (number) - Transaction amount
  - `date` (string) - Date in YYYY-MM-DD format
  - `checked` (boolean) - User verification status
  - `split` (optional boolean) - Whether expense is split (50/50) or individual (100%), defaults to true
  - `year` (number) - Year for filtering
  - `month` (string) - Month in 2-digit format (01, 02, etc.)
  - `uploadTimestamp` (optional number) - When expense was added (for unseen tracking)
  - `category` (optional string) - AI-assigned expense category
  - `merchantName` (optional string) - Normalized merchant name (e.g., "WOOLWORTHS")
  - Index: `by_expense_id` on `expenseId`
- `uploads`:
  - `filename` (string) - Uploaded file name
  - `size` (number) - File size in bytes
  - `uploadDate` (number) - Timestamp
  - `status` (string) - "success" or "error"
  - `errorMessage` (optional string) - Error details if failed
- `merchantMappings`:
  - `merchantName` (string) - Normalized merchant name (e.g., "WOOLWORTHS")
  - `category` (string) - Most common category for this merchant
  - `confidence` (string) - "ai" | "user" | "consensus"
  - `voteCount` (number) - Number of user confirmations
  - `categoryVotes` (optional object) - JSON object tracking votes per category
  - `aiSuggestion` (optional string) - Original AI suggestion
  - `lastUpdated` (number) - Timestamp
  - Index: `by_merchant` on `merchantName`
- `personalMappings`:
  - `userId` (string) - User ID (or anonymous device ID)
  - `merchantName` (string) - Normalized merchant name
  - `category` (string) - User's preferred category for this merchant
  - `createdAt` (number) - Timestamp
  - Index: `by_user_merchant` on `userId` and `merchantName`

**Common Convex Queries & Mutations:**

```typescript
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'

// Query expenses by year
const yearData = useQuery(api.expenses.getExpensesByYear, { year: 2024 })

// Get year summary with comparisons
const summary = useQuery(api.expenses.getYearSummary, {
  year: 2024,
  sessionStartTime: Date.now()
})

// Get month expenses
const monthData = useQuery(api.expenses.getMonthExpenses, {
  year: 2024,
  month: "01"
})

// Toggle expense checked status
const toggleExpense = useMutation(api.expenses.toggleExpense)
await toggleExpense({ expenseId: "abc123" })

// Toggle split status
const toggleSplit = useMutation(api.expenses.toggleSplit)
await toggleSplit({ expenseId: "abc123" })

// Toggle all expenses in a month
const toggleAll = useMutation(api.expenses.toggleAllExpenses)
await toggleAll({ year: 2024, month: "01", checked: true })

// Add expenses with AI categorization
const addWithCategories = useAction(api.expenses.addExpensesWithCategories)
await addWithCategories({
  expenses: parsedExpenses,
  userId: 'anonymous'
})
```

## Form Management

### File Upload Pattern

The application supports multi-file uploads for both PDF bank statements and CSV expense files:

```typescript
// src/routes/api.upload.ts
export async function POST({ request }: { request: Request }) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  for (const file of files) {
    const isPDF = file.type === 'application/pdf'
    const isCSV = file.type === 'text/csv' || file.name.endsWith('.csv')

    if (isPDF) {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parseResult = await parsePDF(buffer)
      // Process PDF expenses...
    } else if (isCSV) {
      const text = await file.text()
      const parseResult = await parseCSV(text, file.name)
      // Process CSV expenses...
    }
  }

  return Response.json({ success: true, files: results })
}
```

**Supported File Types:**
- **PDF**: Bank statements (NAB format)
- **CSV**: Expense exports (Google Sheets, NAB CSV exports)
  - Can extract date from filename if no Date column
  - Supports section headers for split/individual expenses
  - Auto-verifies CSV expenses as checked

### TanStack Form with Zod Validation

For general form handling:

```typescript
import { z } from 'zod'
import { useForm } from '@tanstack/react-form'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number().positive('Amount must be positive'),
})

function ExpenseForm() {
  const form = useForm({
    defaultValues: {
      name: '',
      amount: 0,
    },
    onSubmit: async ({ value }) => {
      // Handle submission
      console.log('Form submitted:', value)
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      form.handleSubmit()
    }}>
      {/* Form fields */}
    </form>
  )
}
```

## Styling

### Tailwind CSS

- **Version**: 4.0.6 (latest)
- **Configuration**: Uses CSS variables for theming
- **Base Color**: Zinc (components.json:9)
- **Global Styles**: `src/styles.css`

### Utility Function

Use `cn()` helper from `src/lib/utils.ts:4-6` for conditional classes:

```typescript
import { cn } from '@/lib/utils'

<div className={cn(
  'base-class',
  isActive && 'active-class',
  'another-class'
)} />
```

### Shadcn/UI Components

Add new components with:

```bash
pnpx shadcn@latest add [component-name]
```

Configuration in `components.json`:
- Style: new-york
- Aliases: `@/components`, `@/lib/utils`, etc.
- Icon library: lucide

## Development Workflow

### Scripts

```bash
pnpm dev        # Start dev server on port 3000
pnpm build      # Production build
pnpm serve      # Preview production build
pnpm test       # Run Vitest tests
pnpm lint       # Lint with Biome
pnpm format     # Format with Biome
pnpm check      # Run both lint and format checks
```

### Starting Development

1. Install dependencies: `pnpm install`
2. Set up Convex (if needed):
   - Create `.env.local` with `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT`
   - Or run `npx convex init`
   - Start Convex: `npx convex dev`
3. Start dev server: `pnpm dev`
4. Open http://localhost:3000

### Testing

- Framework: Vitest 4.0.9
- Testing Library: @testing-library/react 16.3.0
- Testing Library DOM: @testing-library/dom 10.4.1
- DOM Environment: jsdom 27.2.0

Run tests: `pnpm test`

Note: Test files should be placed alongside the code they test or in a `__tests__` directory.

### Building

```bash
pnpm build
```

Output directory: `dist/client` (netlify.toml:3)

## Deployment

### Netlify Configuration (netlify.toml)

- **Build Command**: `vite build`
- **Publish Directory**: `dist/client`
- **Dev Command**: `vite dev`
- **Dev Port**: 3000

Plugins configured in vite.config.ts:
- `@tanstack/devtools-vite` for TanStack devtools
- `@netlify/vite-plugin-tanstack-start` for Netlify deployment
- `vite-tsconfig-paths` for path alias support
- `@tailwindcss/vite` for Tailwind CSS
- `@tanstack/react-start/plugin/vite` for TanStack Start
- `@vitejs/plugin-react` for React support

## Key Patterns & Best Practices

### 1. Component Structure

```typescript
// Imports first
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

// Route export
export const Route = createFileRoute('/path')({ component: MyComponent })

// Component definition
function MyComponent() {
  // Hooks
  const [state, setState] = useState(false)

  // Early returns for loading/error states
  if (loading) return <div>Loading...</div>

  // Main render
  return <div>Content</div>
}
```

### 2. Type Safety

- Always use TypeScript
- Leverage Zod for runtime validation
- Use inferred types from loaders: `Route.useLoaderData()`
- Enable strict mode (already configured)

### 3. Server Functions

TanStack Start supports server functions:

```typescript
import { createServerFn } from '@tanstack/react-start'

export const getData = createServerFn('GET', async () => {
  // Server-side code only
  return { data: 'from server' }
})
```

### 4. API Routes

API routes use `.ts` extension with `api.` prefix in routes folder:

```typescript
// src/routes/api.upload.ts
export async function POST({ request }: { request: Request }) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // Process the file
  const buffer = await file.arrayBuffer()
  // Parse PDF and extract transactions

  return Response.json({ success: true, transactions: parsedData })
}
```

API routes can export handlers for: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`

### 5. Environment Variables

- Prefix client variables with `VITE_`
- Use `.env.local` for local development (not committed)
- Convex requires:
  - `VITE_CONVEX_URL` - Convex deployment URL
  - `CONVEX_DEPLOYMENT` - Convex deployment name
  - `OPENROUTER_API_KEY` - OpenRouter API key for AI categorization (Convex env var)

### 6. Error Handling

```typescript
export const Route = createFileRoute('/path')({
  component: MyComponent,
  errorComponent: ({ error }) => <div>Error: {error.message}</div>,
})
```

### 7. Loading States

```typescript
export const Route = createFileRoute('/path')({
  component: MyComponent,
  pendingComponent: () => <div>Loading...</div>,
})
```

## Common Tasks

### Adding a New Page

1. Create file in `src/routes/`, e.g., `src/routes/reports.tsx`
2. Export route using `createFileRoute()`
3. Define component
4. Add navigation link in `src/components/Header.tsx` if needed

Example:
```typescript
// src/routes/reports.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/reports')({
  component: Reports,
})

function Reports() {
  return <div>Reports Page</div>
}
```

### Adding a Dynamic Route

For routes with parameters:

**Example 1: Year Route**
```typescript
// src/routes/$year.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$year')({
  component: YearSummary,
})

function YearSummary() {
  const { year } = Route.useParams()
  return <div>Expenses for {year}</div>
}
```

**Example 2: Nested Dynamic Route**
```typescript
// src/routes/m/$yearMonth.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/m/$yearMonth')({
  component: MonthView,
})

function MonthView() {
  const { yearMonth } = Route.useParams()
  const [year, month] = yearMonth.split('-')
  return <div>Month view for {year}-{month}</div>
}
```

### Adding a UI Component

```bash
pnpx shadcn@latest add button
# Component added to src/components/ui/button.tsx
```

Available Shadcn components: button, input, label, select, slider, switch, textarea, and more.

### Creating an API Endpoint

1. Create `.ts` file with `api.` prefix in `src/routes/`, e.g., `src/routes/api.export.ts`
2. Export HTTP method handlers: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
3. Return `Response.json()` or `new Response()`

Example:
```typescript
// src/routes/api.export.ts
export async function GET() {
  return Response.json({ data: 'exported data' })
}
```

### Setting up Convex Functions

1. Define schema in `convex/schema.ts`
2. Create function file in `convex/`, e.g., `convex/reports.ts`
3. Use in components with `useQuery` or `useMutation` from `convex/react`

Example:
```typescript
// convex/reports.ts
import { query } from './_generated/server'

export const getMonthlyReport = query({
  args: { year: v.number(), month: v.string() },
  handler: async (ctx, { year, month }) => {
    return await ctx.db
      .query('expenses')
      .filter((q) => q.and(
        q.eq(q.field('year'), year),
        q.eq(q.field('month'), month)
      ))
      .collect()
  },
})
```

### Working with AI Categorization

**Adding Categorization to Upload Flow:**

```typescript
// In your upload handler (src/routes/api.upload.ts or similar)
import { api } from '../convex/_generated/api'

// After parsing expenses from PDF/CSV:
const result = await convex.action(api.expenses.addExpensesWithCategories, {
  expenses: parseResult.expenses,
  userId: 'anonymous' // or actual user ID when auth is added
})
```

**Updating Categories with User Feedback:**

```typescript
// When user changes a category
await convex.action(api.categorization.updateExpenseCategoryWithMapping, {
  expenseId: expense.expenseId,
  merchantName: expense.merchantName, // Must be normalized
  category: 'Groceries',
  userId: 'anonymous',
  updateAllFromMerchant: true // Apply to all future expenses from this merchant
})
```

**Adding New Merchants to Known List:**

Edit `convex/utils.ts` and add to the `knownMerchants` array:

```typescript
const knownMerchants = [
  // ... existing merchants
  "NEW MERCHANT NAME",
]
```

**Testing Merchant Normalization:**

```typescript
import { normalizeMerchant } from './convex/utils'

console.log(normalizeMerchant("ACME STORE SYDNEY 456"))
// Should output: "ACME" or "ACME STORE" if multi-word merchant
```

### Working with PDF & CSV Parsers

The application includes parsers for both PDF and CSV expense files:

**PDF Parser** (`src/lib/pdf-parser.ts`):
```typescript
import { parsePDF } from '@/lib/pdf-parser'

const buffer = await file.arrayBuffer()
const parseResult = await parsePDF(Buffer.from(buffer))
// Returns { expenses: ParsedExpense[], status: 'success' | 'error', errorMessage?: string }
// Each expense includes: expenseId, name, amount, date, year, month, checked, split
```

**CSV Parser** (`src/lib/csv-parser.ts`):
```typescript
import { parseCSV } from '@/lib/csv-parser'

const fileContent = await file.text()
const parseResult = await parseCSV(fileContent, file.name)
// Returns { expenses: ParsedExpense[], status: 'success' | 'error', errorMessage?: string }
// Supports filename-based date extraction and section headers
```

**Date Formats Supported:**
- DD/MM/YY and DD/MM/YYYY (Australian)
- MM/DD/YYYY (US)
- DD-MMM-YYYY (15-Jan-2024)
- YYYY-MM-DD (ISO)
- MMM DD, YYYY (Jan 15, 2024)
- DD Mon YY (29 Aug 25)
- ISO 8601 datetime

## Application Features

### Expense Tracking

The application provides the following core features:

1. **Multi-File Upload**: Upload multiple PDF and CSV files simultaneously
2. **PDF Parsing**: Automatic transaction extraction from NAB bank statements
3. **CSV Parsing**: Support for Google Sheets and NAB CSV exports
   - Filename-based date extraction
   - Section-based split/individual expense detection
   - Flexible column detection (Date, Item, Cost)
4. **AI-Powered Categorization**: Automatic expense categorization using OpenRouter + Groq
   - 13 predefined categories
   - Merchant normalization (80+ known merchants)
   - Three-tier learning system (personal → global → AI)
5. **Year-Based Organization**: View expenses organized by year with aggregates
6. **Month Grouping**: Expenses grouped by month with totals
7. **Expense Verification**: Mark transactions as checked/verified
8. **Split Expense Tracking**: Distinguish between split (50/50) and individual (100%) expenses
9. **Bulk Operations**: Toggle all expenses in a month
10. **Year-over-Year Comparison**: Track spending trends
11. **Unseen Expense Tracking**: Visual indicators for new expenses
12. **Real-Time Sync**: Changes sync in real-time via Convex

### Supported Bank Statement Formats

**PDF Formats:**
- NAB (National Australia Bank) statement format:
  - Date formats: DD/MM/YY, DD/MM/YYYY, DD Mon YY
  - Transaction descriptions
  - Debit amounts (expenses tracked as positive numbers)
  - Example: `example/0513-20250919-statement.pdf`

**CSV Formats:**
- Google Sheets exports (custom expense tracking)
- NAB CSV exports (e.g., "August2025Transactions.csv")
- Generic CSV with columns: Date (optional), Item/Description, Cost/Amount
- Section-based CSVs (split vs individual expenses)
- Filename-based date extraction (e.g., "Expenses 2023 - January.csv")

**CSV Section Headers:**
CSV files can include section headers to categorize expenses:
- "General expenses" / "Shared" / "Split" → Shared expenses (50/50)
- "Individual" / "Personal" → Individual expenses (100%)

## AI-Powered Expense Categorization

The application includes an intelligent categorization system using OpenRouter + Groq (free tier) to automatically categorize expenses.

### Architecture

**Three-Tier Categorization System:**
1. **Personal Mappings** (highest priority) - User-specific overrides
2. **Global Mappings** (crowd-sourced) - Community consensus categories
3. **AI Categorization** (fallback) - OpenRouter + Groq API

### Supported Categories

```typescript
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
  "Other"
]
```

### Merchant Normalization

Before categorization, merchant names are normalized using `convex/utils.ts`:

```typescript
import { normalizeMerchant } from './utils'

// Examples:
normalizeMerchant("WOOLWORTHS TOWN HALL 123") // → "WOOLWORTHS"
normalizeMerchant("BP NORTHSIDE") // → "BP"
normalizeMerchant("NETFLIX.COM") // → "NETFLIX"
```

**Normalization Process:**
1. Convert to uppercase
2. Remove domains (.com, .com.au, etc.)
3. Remove location codes and transaction IDs
4. Match against known merchant database (80+ Australian merchants)
5. Extract first 1-2 significant words

### Convex Functions

**Key categorization functions (convex/categorization.ts):**

- `categorizeMerchantWithAI(merchantName, description)` - Action that calls OpenRouter API
- `getCategoryForMerchant(merchantName, description, userId)` - Main categorization flow
- `updateExpenseCategoryWithMapping(expenseId, merchantName, category, userId, updateAllFromMerchant)` - Update category with learning
- `getGlobalMapping(merchantName)` - Query global merchant mapping
- `getPersonalMapping(userId, merchantName)` - Query user's personal mapping

### Environment Variables

Required for AI categorization:
- `OPENROUTER_API_KEY` - OpenRouter API key (set in Convex dashboard)

**Model Used:**
- `meta-llama/llama-3.2-3b-instruct:free` (Free Groq model via OpenRouter)
- Temperature: 0.3 (for consistent categorization)
- Max tokens: 20 (only need category name)

### Usage Example

```typescript
import { api } from '../convex/_generated/api'

// Automatically categorize expenses during upload
const result = await ctx.runAction(api.expenses.addExpensesWithCategories, {
  expenses: parsedExpenses,
  userId: 'anonymous' // or actual user ID
})

// Update category with user feedback
await ctx.runAction(api.categorization.updateExpenseCategoryWithMapping, {
  expenseId: expense.expenseId,
  merchantName: expense.merchantName,
  category: 'Groceries',
  userId: 'anonymous',
  updateAllFromMerchant: true // Create personal override
})
```

### Learning System

The categorization system improves over time:
1. **AI First Use**: First time seeing a merchant, AI categorizes it
2. **Global Learning**: AI suggestion stored in `merchantMappings` table
3. **User Feedback**: When users change categories, system votes on better category
4. **Personal Overrides**: Users can set permanent overrides for specific merchants
5. **Consensus Building**: Multiple user votes update global mappings

## Advanced Features

### Split vs Individual Expenses

Expenses can be marked as:
- **Split (50/50)**: Default for PDF uploads and "Shared" CSV sections
- **Individual (100%)**: For personal expenses from "Individual" CSV sections

Toggle split status with `toggleSplit` mutation:

```typescript
await convex.mutation(api.expenses.toggleSplit, {
  expenseId: expense.expenseId
})
```

### Toggle All Expenses

Bulk check/uncheck all expenses in a month:

```typescript
await convex.mutation(api.expenses.toggleAllExpenses, {
  year: 2024,
  month: "01",
  checked: true
})
```

### Year Summary & Comparisons

The `getYearSummary` query provides:
- Total shared expenses for the year
- Average per month
- Year-over-year comparison (increase/decrease)
- All 12 months with data (even if zero)
- Unseen expense tracking (green dot indicators)

```typescript
const summary = useQuery(api.expenses.getYearSummary, {
  year: 2024,
  sessionStartTime: Date.now() // For tracking unseen expenses
})
```

### Unseen Expense Tracking

New expenses uploaded during a session are tracked:
- `uploadTimestamp` field stores when expense was added
- `sessionStartTime` parameter tracks user's session start
- Green dot indicators on months with new expenses
- Cleared when user visits that month

## Important Notes for AI Assistants

### When Making Changes

1. **Always use tabs for indentation** (biome.json enforces this)
2. **Use double quotes** for strings in TS/JS
3. **Run `pnpm check`** before committing to ensure code quality
4. **Use path aliases**: `@/components/Button` not `../components/Button`
5. **Follow file-based routing conventions** for new routes
6. **Don't modify `_generated` folders** - these are auto-generated

### Security Considerations

1. **Server functions** run only on the server - safe for secrets
2. **Client variables** must be prefixed with `VITE_` to be exposed
3. **Validate all inputs** with Zod schemas
4. **Use TypeScript strict mode** to catch errors early

### Performance Best Practices

1. **Use route loaders** for data needed at render time
2. **Leverage TanStack Query** for caching and deduplication
3. **Code split** large components with dynamic imports
4. **Optimize images** before adding to `/public`
5. **Use Convex indexes** for efficient queries (e.g., `by_expense_id` index)
6. **Handle large PDFs** efficiently by streaming when possible

### Application-Specific Guidelines

1. **File Processing**:
   - Validate PDF and CSV files before parsing
   - Support multi-file uploads
   - Handle both PDF and CSV parsing errors gracefully
2. **Transaction Deduplication**: Use `expenseId` (hash of name+amount+date) to prevent duplicate entries
3. **Date Handling**: Store dates in YYYY-MM-DD format for consistency
4. **Error Handling**: Track upload errors in the `uploads` table for debugging
5. **Year/Month Filtering**: Always filter by year first, then month for performance
6. **AI Categorization**:
   - Always normalize merchant names before categorization
   - Check personal mappings before global mappings
   - Fall back to AI only when no mapping exists
   - Store AI results in global mappings for future use
7. **Split Expense Tracking**:
   - Default PDF expenses to split=true (50/50)
   - Respect CSV section headers for split vs individual
   - CSV "Shared" sections → split=true
   - CSV "Individual" sections → split=false
8. **CSV Parsing**:
   - Extract date from filename if no Date column
   - Support flexible column names (Item, Description, Merchant Name, etc.)
   - Auto-verify CSV expenses as checked=true
   - Handle section headers for expense categorization
9. **Merchant Normalization**:
   - Use `convex/utils.ts` normalizeMerchant() function
   - Maintain known merchant database in utils.ts
   - Normalize before storing in merchantName field

### Debugging

- **Router Devtools**: Included in development (bottom-right)
- **Query Devtools**: Included in development (bottom-right)
- **React Devtools**: Use browser extension
- **Convex Dashboard**: Monitor backend at convex.dev

## Additional Resources

- [TanStack Start Docs](https://tanstack.com/start)
- [TanStack Router Docs](https://tanstack.com/router)
- [TanStack Query Docs](https://tanstack.com/query)
- [TanStack Form Docs](https://tanstack.com/form)
- [Convex Docs](https://docs.convex.dev)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [Shadcn/UI Docs](https://ui.shadcn.com)
- [Biome Docs](https://biomejs.dev)

## Version Information

**Last updated**: 2025-11-16
**Node version**: Compatible with Vite 7.2.2 (Node 18+)
**Package manager**: pnpm
**TypeScript**: 5.9.3
**React**: 19.2.0
**TanStack Start**: 1.136.4

### Recent Changes

**November 2025:**
- **AI-Powered Categorization**: Integrated OpenRouter + Groq for automatic expense categorization
  - Three-tier categorization system (personal → global → AI)
  - 13 predefined expense categories
  - Merchant normalization with 80+ known merchants
  - Learning system with user feedback and consensus building
- **CSV Parsing**: Full CSV support for expense imports
  - Google Sheets exports
  - NAB CSV exports (e.g., "August2025Transactions.csv")
  - Filename-based date extraction
  - Section header detection for split/individual expenses
  - Flexible column detection
- **Split Expense Tracking**: Track split (50/50) vs individual (100%) expenses
  - Section-based detection in CSVs
  - Toggle split status per expense
- **Multi-File Upload**: Upload multiple PDF and CSV files simultaneously
- **Year Summary & Comparisons**: Year-over-year spending analysis
  - Total shared expenses
  - Average per month
  - Year-over-year comparison indicators
  - All 12 months with data (even if zero)
- **Bulk Operations**: Toggle all expenses in a month
- **Unseen Expense Tracking**: Visual indicators for new expenses uploaded during session
- **Enhanced Routing**:
  - `/$year` route for year summaries with aggregates
  - `/m/$yearMonth` for compact month views
- **Database Schema Enhancements**:
  - Added `split`, `category`, `merchantName`, `uploadTimestamp` fields to expenses
  - New `merchantMappings` table for global categorization
  - New `personalMappings` table for user-specific overrides

**Previous Changes:**
- Removed all demo routes and components
- Implemented expense tracking functionality
- Added PDF parser for bank statements (NAB format)
- Created year-based expense routing
- Updated to latest dependency versions
