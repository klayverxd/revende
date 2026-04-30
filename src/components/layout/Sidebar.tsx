"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { navGroups, isNavItemActive } from "./nav-config";
import { signOutAction } from "@/app/(app)/actions";

type Props = { user: User };

interface BeforeInstallPromptEvent extends Event {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function Sidebar({ user }: Props) {
	const pathname = usePathname();
	const [installPrompt, setInstallPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);

	useEffect(() => {
		const handler = (e: Event) => {
			e.preventDefault();
			setInstallPrompt(e as BeforeInstallPromptEvent);
		};
		window.addEventListener("beforeinstallprompt", handler);
		return () => window.removeEventListener("beforeinstallprompt", handler);
	}, []);

	async function handleInstall() {
		if (!installPrompt) return;
		await installPrompt.prompt();
		const { outcome } = await installPrompt.userChoice;
		if (outcome === "accepted") setInstallPrompt(null);
	}

	return (
		<aside className="hidden md:flex fixed inset-y-0 left-0 w-[196px] flex-col bg-[#0C447C] z-30">
			{/* Logo */}
			<div className="px-5 py-5 border-b border-white/10 shrink-0">
				<p className="text-white font-bold text-base tracking-tight leading-none">
					Revendê
				</p>
				<p className="text-[#B5D4F4] text-xs mt-1">Controle de vendas</p>
			</div>

			{/* Nav groups */}
			<nav className="flex-1 overflow-y-auto py-3 px-2">
				{navGroups.map(group => (
					<div key={group.label} className="mb-4 last:mb-0">
						<p className="text-[#378ADD] text-[10px] font-semibold tracking-widest px-3 mb-1 select-none">
							{group.label}
						</p>
						{group.items.map(item => {
							const active = isNavItemActive(pathname, item.href);
							return (
								<Link
									key={item.href}
									href={item.href}
									className={`flex items-center px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
										active
											? "bg-[#185FA5] text-white font-medium"
											: "text-[#B5D4F4] hover:bg-white/10 hover:text-white"
									}`}
								>
									{item.label}
								</Link>
							);
						})}
					</div>
				))}
			</nav>

			{/* Footer — user + logout */}
			<div className="px-3 py-4 border-t border-white/10 shrink-0">
				<p
					className="text-[#B5D4F4] text-xs px-3 mb-2 truncate"
					title={user.email}
				>
					{user.email}
				</p>
				{installPrompt && (
					<button
						type="button"
						onClick={handleInstall}
						className="w-full text-left text-sm text-[#378ADD] hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors mb-1"
					>
						Instalar app
					</button>
				)}
				<form action={signOutAction}>
					<button
						type="submit"
						className="w-full text-left text-sm text-[#B5D4F4] hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
					>
						Sair
					</button>
				</form>
			</div>
		</aside>
	);
}
