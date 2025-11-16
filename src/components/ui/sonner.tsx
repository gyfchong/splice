import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-white group-[.toaster]:text-zinc-950 group-[.toaster]:border-zinc-200 group-[.toaster]:shadow-lg",
					description: "group-[.toast]:text-zinc-500",
					actionButton:
						"group-[.toast]:bg-cyan-600 group-[.toast]:text-white hover:group-[.toast]:bg-cyan-700",
					cancelButton:
						"group-[.toast]:bg-zinc-100 group-[.toast]:text-zinc-500",
				},
			}}
			{...props}
		/>
	)
}

export { Toaster }
