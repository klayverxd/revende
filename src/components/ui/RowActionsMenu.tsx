"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export interface RowAction {
	label: string;
	onClick?: () => void;
	href?: string;
	variant?: "default" | "danger";
	disabled?: boolean;
}

interface Props {
	actions: RowAction[];
	label?: string;
}

export default function RowActionsMenu({ actions, label }: Props) {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	useEffect(() => {
		if (!open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	function handleAction(action: RowAction) {
		if (action.disabled) return;
		setOpen(false);
		if (action.href) {
			router.push(action.href);
		} else {
			action.onClick?.();
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={e => {
					e.stopPropagation();
					setOpen(true);
				}}
				className="inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-gray-700 hover:bg-[#E6F1FB] transition-colors"
				aria-label="Abrir ações"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
				>
					<circle cx="12" cy="5" r="2" />
					<circle cx="12" cy="12" r="2" />
					<circle cx="12" cy="19" r="2" />
				</svg>
			</button>

			{open && (
				/* Overlay — clique fora fecha */
				<div
					className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
					onClick={() => setOpen(false)}
					aria-hidden="true"
				>
					{/* Painel — stopPropagation para não fechar ao clicar dentro */}
					<div
						className="bg-white rounded-xl border border-[#B5D4F4] shadow-lg w-56 overflow-hidden"
						onClick={e => e.stopPropagation()}
					>
						{/* Título opcional */}
						{label && (
							<div className="px-4 pt-3 pb-2 border-b border-[#B5D4F4]">
								<p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
									{label}
								</p>
							</div>
						)}

						{/* Ações */}
						<ul className="flex flex-col py-1">
							{actions.map(action => (
								<li key={action.label}>
									<button
										type="button"
										disabled={action.disabled}
										onClick={() => handleAction(action)}
										className={[
											"w-full text-left px-4 py-2.5 text-sm font-medium transition-colors",
											action.disabled
												? "text-gray-300 cursor-not-allowed"
												: action.variant === "danger"
													? "text-red-600 hover:bg-red-50 active:bg-red-100"
													: "text-gray-800 hover:bg-[#E6F1FB] active:bg-[#d0e8f8]",
										].join(" ")}
									>
										{action.label}
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</>
	);
}
