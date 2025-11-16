import { Toast } from "@base-ui-components/react/toast"
import * as React from "react"

// Toast Provider wrapper
export function ToastProvider({ children }: { children: React.ReactNode }) {
	return (
		<Toast.Provider>
			{children}
			<ToastRenderer />
		</Toast.Provider>
	)
}

// Toast Renderer that listens to toasts and renders them
function ToastRenderer() {
	const { toasts } = Toast.useToastManager()

	return (
		<Toast.Viewport
			className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:top-auto sm:right-0 sm:flex-col md:max-w-[420px] gap-2"
			render={(props) => <ol {...props} />}
		>
			{toasts.map((toast) => (
				<ToastItem key={toast.id} toast={toast} />
			))}
		</Toast.Viewport>
	)
}

// Toast component that renders individual toasts
function ToastItem({ toast }: { toast: any }) {
	return (
		<Toast.Root
			className="group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border border-zinc-200 bg-white p-6 pr-8 shadow-lg transition-all data-[ending]:animate-out data-[ending]:fade-out-80 data-[ending]:slide-out-to-right-full"
		>
			<Toast.Content className="flex-1">
				<div className="grid gap-1">
					{toast.title && (
						<Toast.Title className="text-sm font-semibold text-zinc-900">
							{toast.title}
						</Toast.Title>
					)}
					{toast.description && (
						<Toast.Description className="text-sm text-zinc-600">
							{toast.description}
						</Toast.Description>
					)}
				</div>
				{toast.actionProps && (
					<Toast.Action
						{...toast.actionProps}
						className="mt-2 inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-700 transition-colors"
					/>
				)}
			</Toast.Content>
			<Toast.Close className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-900 focus:opacity-100 focus:outline-none group-hover:opacity-100">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</Toast.Close>
		</Toast.Root>
	)
}

// Export Toast namespace and useToastManager for usage in components
export { Toast }
export const useToast = Toast.useToastManager

