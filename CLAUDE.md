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
- **Utilities**: clsx 2.1.1, tailwind-merge 3.4.0, class-variance-authority 0.7.1
- **Animations**: tw-animate-css 1.4.0
- **Deployment**: Netlify
- **Package Manager**: pnpm

### Additional Dev Dependencies

- **Types**: @types/node 24.10.1, @types/pdf-parse 1.1.5
- **Performance**: web-vitals 5.1.0

## Directory Structure

```
/home/gyfchong/Code/splice/
├── convex/                    # Backend code (Convex)
│   ├── _generated/           # Auto-generated Convex files
│   ├── schema.ts             # Database schema definitions
│   ├── expenses.ts           # Expense-related Convex functions
│   └── tsconfig.json         # TypeScript config for Convex
├── example/                   # Example files for testing
│   └── 0513-20250919-statement.pdf # Sample bank statement
├── public/                   # Static assets
│   └── manifest.json         # PWA manifest
├── src/
│   ├── components/           # React components
│   │   ├── ui/              # Shadcn UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── switch.tsx
│   │   │   └── textarea.tsx
│   │   └── Header.tsx       # Main navigation header
│   ├── data/                # Static data/constants (currently empty)
│   ├── integrations/        # Third-party integrations
│   │   ├── convex/
│   │   │   └── provider.tsx # Convex provider wrapper
│   │   └── tanstack-query/
│   │       ├── root-provider.tsx
│   │       └── devtools.tsx
│   ├── lib/                 # Utility functions
│   │   ├── utils.ts         # cn() helper for Tailwind
│   │   └── pdf-parser.ts    # PDF bank statement parser
│   ├── routes/              # File-based routes
│   │   ├── year/
│   │   │   └── $year.tsx    # Dynamic year route for expenses
│   │   ├── __root.tsx       # Root layout component
│   │   ├── index.tsx        # Home page with upload
│   │   └── api.upload.ts    # File upload API endpoint
│   ├── router.tsx           # Router configuration
│   ├── routeTree.gen.ts     # Auto-generated route tree
│   ├── styles.css           # Global styles (Tailwind)
│   └── logo.svg             # App logo
├── .vscode/                 # VS Code settings
├── biome.json              # Biome configuration
├── components.json         # Shadcn configuration
├── netlify.toml            # Netlify deployment config
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
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

1. Routes go in `src/routes/` (file-based routing)
   - API routes: Prefix with `api.` (e.g., `api.upload.ts`)
   - Dynamic routes: Use `$` prefix for parameters (e.g., `$year.tsx`)
2. Reusable components in `src/components/`
3. UI primitives in `src/components/ui/` (Shadcn components)
4. Utilities in `src/lib/`
   - `utils.ts` - Tailwind helper functions
   - `pdf-parser.ts` - Bank statement PDF parsing
5. Integration wrappers in `src/integrations/`
   - `convex/` - Convex backend provider
   - `tanstack-query/` - Query client setup
6. Static assets in `public/`
7. Example files in `example/` (for testing, not deployed)
8. Convex backend in `convex/` (separate from src/)

## Routing System

### File-Based Routing (TanStack Router)

Routes are automatically generated from files in `src/routes/`:

- `index.tsx` → `/` (home page with PDF upload)
- `year/$year.tsx` → `/year/2024` (dynamic year route for expenses)
- `api.upload.ts` → `/api/upload` (file upload endpoint)
- `__root.tsx` → Layout wrapper for all routes

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

<Link to="/">Home</Link>
<Link to="/year/2024" activeProps={{ className: 'active' }}>
  2024 Expenses
</Link>
// Dynamic year parameter
<Link to="/year/$year" params={{ year: '2025' }}>
  2025 Expenses
</Link>
```

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
  - `year` (number) - Year for filtering
  - `month` (string) - Month in 2-digit format (01, 02, etc.)
  - Index: `by_expense_id` on `expenseId`
- `uploads`:
  - `filename` (string) - Uploaded file name
  - `size` (number) - File size in bytes
  - `uploadDate` (number) - Timestamp
  - `status` (string) - "success" or "error"
  - `errorMessage` (optional string) - Error details if failed

**Usage:**
```typescript
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

const expenses = useQuery(api.expenses.getExpensesByYear, { year: 2024 })
```

## Form Management

### File Upload Pattern

The application uses standard HTML form uploads for PDF bank statements:

```typescript
// src/routes/api.upload.ts
export async function POST({ request }: { request: Request }) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file || file.type !== 'application/pdf') {
    return new Response(JSON.stringify({ error: 'Invalid file' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Process file...
  return Response.json({ success: true, data: processedData })
}
```

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
- Convex requires: `VITE_CONVEX_URL`, `CONVEX_DEPLOYMENT`

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

For routes with parameters (like the year route):

```typescript
// src/routes/year/$year.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/year/$year')({
  component: YearExpenses,
})

function YearExpenses() {
  const { year } = Route.useParams()
  return <div>Expenses for {year}</div>
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

### Working with PDF Parser

The application includes a PDF parser in `src/lib/pdf-parser.ts` for extracting transactions from bank statements:

```typescript
import { parsePDF } from '@/lib/pdf-parser'

const buffer = await file.arrayBuffer()
const transactions = await parsePDF(Buffer.from(buffer))
// Returns array of { date, description, amount }
```

## Application Features

### Expense Tracking

The application provides the following core features:

1. **PDF Upload & Parsing**: Upload bank statements in PDF format (NAB bank format supported)
2. **Automatic Transaction Extraction**: Automatically parse transactions with date, description, and amount
3. **Year-Based Organization**: View expenses organized by year
4. **Month Grouping**: Expenses are grouped by month within each year
5. **Expense Verification**: Mark transactions as checked/verified
6. **Real-Time Sync**: Changes sync in real-time via Convex

### Supported Bank Statement Formats

Currently supports NAB (National Australia Bank) statement format with:
- Date formats: DD/MM/YY and DD/MM/YYYY
- Transaction descriptions
- Debit amounts (expenses tracked as positive numbers)

Example file: `example/0513-20250919-statement.pdf`

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

1. **PDF Processing**: Always validate PDF files before parsing
2. **Transaction Deduplication**: Use `expenseId` to prevent duplicate entries
3. **Date Handling**: Store dates in YYYY-MM-DD format for consistency
4. **Error Handling**: Track upload errors in the `uploads` table for debugging
5. **Year/Month Filtering**: Always filter by year first, then month for performance

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

**Last updated**: 2025-11-15
**Node version**: Compatible with Vite 7.2.2 (Node 18+)
**Package manager**: pnpm
**TypeScript**: 5.9.3
**React**: 19.2.0
**TanStack Start**: 1.136.4

### Recent Changes

- Removed all demo routes and components
- Implemented expense tracking functionality
- Added PDF parser for bank statements (NAB format)
- Created year-based expense routing
- Updated to latest dependency versions (Nov 2025)
