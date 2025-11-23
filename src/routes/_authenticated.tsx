import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@clerk/tanstack-start/server";
import { getWebRequest } from "vinxi/http";

// Server function to protect authenticated routes
const requireAuth = createServerFn({ method: "GET" }).handler(async () => {
	const { userId } = await getAuth(getWebRequest());
	if (!userId) {
		throw redirect({ to: "/" });
	}
	return { userId };
});

export const Route = createFileRoute("/_authenticated")({
	beforeLoad: async () => await requireAuth(),
	component: () => <Outlet />,
});
