import { ClerkProvider } from "@clerk/tanstack-start";
import type { ReactNode } from "react";

interface ClerkWrapperProps {
	children: ReactNode;
}

export function ClerkWrapper({ children }: ClerkWrapperProps) {
	return <ClerkProvider>{children}</ClerkProvider>;
}
