"use client";

import { ReactNode, useEffect, useCallback } from "react";

interface ModalProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly title?: string;
	readonly children: ReactNode;
	readonly footer?: ReactNode;
}

export default function Modal({
	open,
	onClose,
	title,
	children,
	footer,
}: Readonly<ModalProps>) {
	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		},
		[onClose]
	);

	useEffect(() => {
		if (open) {
			document.addEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "hidden";
		}
		return () => {
			document.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = "";
		};
	}, [open, handleKeyDown]);

	if (!open) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			{/* Overlay */}
			<div
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Card */}
			<div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh] m-auto">
				{/* Header */}
				{title && (
					<div className="flex items-center justify-between px-6 py-4 border-b border-[#B5D4F4]">
						<h2 className="text-base font-semibold text-gray-900">{title}</h2>
						<button
							onClick={onClose}
							className="text-gray-500 hover:text-gray-700 transition-colors rounded p-1 hover:bg-gray-100"
							aria-label="Fechar"
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				)}

				{/* Body */}
				<div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>

				{/* Footer */}
				{footer && (
					<div className="px-6 py-4 border-t border-[#B5D4F4] flex items-center justify-end gap-2">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
