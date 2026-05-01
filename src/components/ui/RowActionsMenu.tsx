"use client";

import { useState } from "react";
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
				<>
					{/* Backdrop */}
					<div
						className="fixed inset-0 z-40 bg-black/25"
						onClick={() => setOpen(false)}
						aria-hidden="true"
					/>

					{/* Bottom sheet on mobile, centered modal on desktop */}
					<div className="fixed inset-x-0 bottom-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:p-4">
						<div className="bg-white rounded-t-2xl md:rounded-2xl border border-[#B5D4F4] shadow-xl md:w-72">
							{/* Handle bar (mobile only) */}
							<div className="md:hidden w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3" />

							{/* Title */}
							{label && (
								<div className="px-5 pt-4 pb-2 border-b border-[#B5D4F4]">
									<p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
										{label}
									</p>
								</div>
							)}

							{/* Actions */}
							<ul className="flex flex-col py-2">
								{actions.map(action => (
									<li key={action.label}>
										<button
											type="button"
											disabled={action.disabled}
											onClick={() => handleAction(action)}
											className={[
												"w-full text-left px-5 py-3 text-sm font-medium transition-colors",
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

							{/* Cancel */}
							<div className="border-t border-[#B5D4F4] py-2">
								<button
									type="button"
									onClick={() => setOpen(false)}
									className="w-full text-left px-5 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50"
								>
									Cancelar
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</>
	);
}
