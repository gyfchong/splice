import { SignUp, SignedIn, SignedOut } from "@clerk/tanstack-start";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getAuth } from "@clerk/tanstack-start/server";
import { getWebRequest } from "vinxi/http";
import { DollarSign } from "lucide-react";

// Server function to check authentication
const authCheck = createServerFn({ method: "GET" }).handler(async () => {
	const { userId } = await getAuth(getWebRequest());
	if (userId) {
		// If authenticated, redirect to dashboard
		throw redirect({ to: "/dashboard" });
	}
	return { userId: null };
});

export const Route = createFileRoute("/sign-up")({
	component: SignUpPage,
	beforeLoad: async () => await authCheck(),
});

function SignUpPage() {
	return (
		<div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center py-12 px-6">
			<div className="max-w-md w-full text-center mb-8">
				<div className="flex items-center justify-center gap-3 mb-4">
					<DollarSign className="w-12 h-12 text-cyan-400" />
					<h1 className="text-5xl font-bold text-white">Luman</h1>
				</div>
				<p className="text-gray-400 text-lg">
					Create your account to start tracking expenses
				</p>
			</div>

			<SignedOut>
				<div className="w-full max-w-md">
					<SignUp
						routing="path"
						path="/sign-up"
						signInUrl="/"
						afterSignUpUrl="/dashboard"
					/>
				</div>
			</SignedOut>

			<SignedIn>
				<div className="text-white">
					Redirecting to dashboard...
				</div>
			</SignedIn>
		</div>
	);
}
