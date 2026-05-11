"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	bottomNavItems,
	navGroups,
	isNavItemActive,
	type BottomNavIcon,
} from "./nav-config";

const iconPaths: Record<BottomNavIcon, React.ReactNode> = {
	home: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
		/>
	),
	inbox: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
		/>
	),
	clipboard: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	),
	cube: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
		/>
	),
	chart: (
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
		/>
	),
};

function NavIcon({ icon }: { icon: BottomNavIcon }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="w-5 h-5"
		>
			{iconPaths[icon]}
		</svg>
	);
}

function GridIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
			strokeWidth={1.5}
			stroke="currentColor"
			className="w-5 h-5"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
			/>
		</svg>
	);
}

export function BottomNav() {
	const pathname = usePathname();
	const [drawerOpen, setDrawerOpen] = useState(false);

	return (
		<>
			{/* Backdrop */}
			{drawerOpen && (
				<button
					type="button"
					aria-label="Fechar menu"
					className="md:hidden fixed inset-0 bg-black/40 z-40 w-full cursor-default"
					onClick={() => setDrawerOpen(false)}
				/>
			)}

			{/* Slide-up drawer */}
			<div
				className={`md:hidden fixed inset-x-0 bottom-[57px] z-50 bg-white rounded-t-2xl border-t border-[#B5D4F4] shadow-xl transition-transform duration-300 ${
					drawerOpen ? "translate-y-0" : "translate-y-full"
				}`}
			>
				<div className="px-4 pt-3 pb-2">
					<div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
					{navGroups.map(group => (
						<div key={group.label} className="mb-3">
							<p className="text-[10px] font-semibold text-gray-400 tracking-widest mb-1.5">
								{group.label}
							</p>
							<div className="flex flex-col gap-0.5">
								{group.items.map(item => {
									const active = isNavItemActive(pathname, item.href);
									return (
										<Link
											key={item.href}
											href={item.href}
											onClick={() => setDrawerOpen(false)}
											className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
												active
													? "bg-[#E6F1FB] text-[#185FA5]"
													: "text-gray-700 hover:bg-gray-50"
											}`}
										>
											{item.label}
										</Link>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Bottom bar */}
			<nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#B5D4F4] flex z-[60] safe-area-inset-bottom">
				{bottomNavItems.map(item => {
					const active = isNavItemActive(pathname, item.href);
					return (
						<Link
							key={item.href}
							href={item.href}
							className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
								active ? "text-[#185FA5]" : "text-gray-400"
							}`}
						>
							<NavIcon icon={item.icon} />
							<span className="text-[10px] font-medium leading-none">
								{item.label}
							</span>
						</Link>
					);
				})}
				{/* Mais button */}
				<button
					type="button"
					onClick={() => setDrawerOpen(v => !v)}
					className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
						drawerOpen ? "text-[#185FA5]" : "text-gray-400"
					}`}
				>
					<GridIcon />
					<span className="text-[10px] font-medium leading-none">Mais</span>
				</button>
			</nav>
		</>
	);
}
