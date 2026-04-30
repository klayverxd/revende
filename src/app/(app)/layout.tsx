import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui";

export default async function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	return (
		<ToastProvider>
			<AppShell user={user}>{children}</AppShell>
		</ToastProvider>
	);
}
