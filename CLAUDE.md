# CLAUDE.md - AI Assistant Development Guide

This file provides comprehensive guidance for AI assistants working on the Splice codebase.

## Project Overview

**Splice** is a full-stack React application built with TanStack Start, featuring server-side rendering, type-safe server functions, and modern React patterns. It serves as a showcase for TanStack ecosystem integration including Router, Query, Form, and Convex backend.

### Tech Stack

- **Framework**: TanStack Start (full-stack React framework)
- **Runtime**: React 19.2.0
- **Language**: TypeScript 5.7.2
- **Build Tool**: Vite 7.1.7
- **Routing**: TanStack Router 1.132.0 (file-based)
- **Data Fetching**: TanStack Query 5.66.5
- **Forms**: TanStack Form 1.0.0
- **Backend**: Convex 1.27.3
- **Styling**: Tailwind CSS 4.0.6
- **UI Components**: Shadcn/UI (Radix UI primitives)
- **Icons**: Lucide React 0.544.0
- **Linting/Formatting**: Biome 2.2.4
- **Testing**: Vitest 3.0.5
- **Validation**: Zod 4.1.11
- **Deployment**: Netlify
- **Package Manager**: pnpm

## Directory Structure

```
/home/user/splice/
├── convex/                    # Backend code (Convex)
│   ├── _generated/           # Auto-generated Convex files
│   ├── schema.ts             # Database schema definitions
│   └── todos.ts              # Example Convex functions
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
│   │   ├── Header.tsx       # Main navigation header
│   │   └── demo.FormComponents.tsx
│   ├── data/                # Static data/constants
│   │   └── demo.punk-songs.ts
│   ├── hooks/               # Custom React hooks
│   │   ├── demo.form.ts
│   │   └── demo.form-context.ts
│   ├── integrations/        # Third-party integrations
│   │   ├── convex/
│   │   │   └── provider.tsx # Convex provider wrapper
│   │   └── tanstack-query/
│   │       ├── root-provider.tsx
│   │       └── devtools.tsx
│   ├── lib/                 # Utility functions
│   │   └── utils.ts         # cn() helper for Tailwind
│   ├── routes/              # File-based routes
│   │   ├── demo/            # Demo routes (can be deleted)
│   │   │   ├── api.*.ts     # API route handlers
│   │   │   ├── convex.tsx
│   │   │   ├── form.*.tsx
│   │   │   ├── start.*.tsx
│   │   │   └── tanstack-query.tsx
│   │   ├── __root.tsx       # Root layout component
│   │   └── index.tsx        # Home page
│   ├── router.tsx           # Router configuration
│   └── styles.css           # Global styles (Tailwind)
├── biome.json              # Biome configuration
├── components.json         # Shadcn configuration
├── netlify.toml            # Netlify deployment config
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── vite.config.ts          # Vite configuration
```

## Code Style & Conventions

### Formatting Rules (Biome)

- **Indentation**: TABS (not spaces) - enforced by biome.json:19
- **Quotes**: Double quotes for JavaScript/TypeScript - biome.json:32
- **Import Organization**: Auto-organized imports enabled - biome.json:23
- **Formatter**: Biome (not Prettier)

### TypeScript Configuration

- **Module Resolution**: Bundler mode (tsconfig.json:11)
- **Strict Mode**: Enabled (tsconfig.json:18)
- **JSX**: react-jsx (tsconfig.json:5)
- **Target**: ES2022 (tsconfig.json:4)
- **Path Aliases**: `@/*` maps to `./src/*` (tsconfig.json:24-26)

### Naming Conventions

- **Demo Files**: Prefix with `demo.` - these can be safely deleted
- **Components**: PascalCase (e.g., `Header.tsx`, `SimpleForm`)
- **Utilities**: camelCase (e.g., `utils.ts`)
- **Routes**: kebab-case or dot-notation (e.g., `form.simple.tsx`)

### File Organization

1. Routes go in `src/routes/` (file-based routing)
2. Reusable components in `src/components/`
3. UI primitives in `src/components/ui/`
4. Custom hooks in `src/hooks/`
5. Utilities in `src/lib/`
6. Integration wrappers in `src/integrations/`

## Routing System

### File-Based Routing (TanStack Router)

Routes are automatically generated from files in `src/routes/`:

- `index.tsx` → `/`
- `about.tsx` → `/about`
- `demo/form.simple.tsx` → `/demo/form/simple`
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

<Link to="/about">About</Link>
<Link to="/demo/form/simple" activeProps={{ className: 'active' }}>
  Form Demo
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
- `products`: title (string), imageId (string), price (number)
- `todos`: text (string), completed (boolean)

**Usage:**
```typescript
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

const todos = useQuery(api.todos.getTodos)
```

## Form Management

### TanStack Form with Zod Validation

Pattern from `src/routes/demo/form.simple.tsx`:

```typescript
import { z } from 'zod'
import { useAppForm } from '@/hooks/demo.form'

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
})

function MyForm() {
  const form = useAppForm({
    defaultValues: {
      title: '',
      description: '',
    },
    validators: {
      onBlur: schema,
    },
    onSubmit: ({ value }) => {
      // Handle submission
    },
  })

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      e.stopPropagation()
      form.handleSubmit()
    }}>
      <form.AppField name="title">
        {(field) => <field.TextField label="Title" />}
      </form.AppField>
      {/* More fields */}
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

- Framework: Vitest 3.0.5
- Testing Library: @testing-library/react 16.2.0
- DOM Environment: jsdom 27.0.0

Run tests: `pnpm test`

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

Plugin: `@netlify/vite-plugin-tanstack-start` configured in vite.config.ts:12

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

API routes use `.ts` extension in routes folder:

```typescript
// src/routes/demo/api.names.ts
export function GET() {
  return Response.json({ names: ['Alice', 'Bob'] })
}
```

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

1. Create file in `src/routes/`, e.g., `src/routes/about.tsx`
2. Export route using `createFileRoute()`
3. Define component
4. Add navigation link in `src/components/Header.tsx` if needed

### Adding a UI Component

```bash
pnpx shadcn@latest add button
# Component added to src/components/ui/button.tsx
```

### Adding a Custom Hook

1. Create file in `src/hooks/`, e.g., `use-my-hook.ts`
2. Export hook function
3. Import with `@/hooks/use-my-hook`

### Creating an API Endpoint

1. Create `.ts` file in `src/routes/`, e.g., `src/routes/api/users.ts`
2. Export HTTP method handlers: `GET`, `POST`, `PUT`, `DELETE`
3. Return `Response.json()` or `new Response()`

### Setting up Convex Functions

1. Define schema in `convex/schema.ts`
2. Create function file in `convex/`, e.g., `convex/users.ts`
3. Use in components with `useQuery` or `useMutation` from `convex/react`

## Demo Files

Files prefixed with `demo.` or in `src/routes/demo/` are examples and can be safely deleted:

- `src/routes/demo/` (entire directory)
- `src/hooks/demo.form.ts`
- `src/hooks/demo.form-context.ts`
- `src/data/demo.punk-songs.ts`
- `src/components/demo.FormComponents.tsx`

These demonstrate various TanStack Start features but are not essential to the application.

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

Last updated: 2025-11-15
Node version: Compatible with Vite 7.1.7 (Node 18+)
Package manager: pnpm
