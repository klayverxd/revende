"use client";

import {
	createContext,
	useContext,
	useState,
	useCallback,
	useMemo,
	ReactNode,
	ReactElement,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
	id: string;
	message: string;
	type: ToastType;
}

interface ToastContextValue {
	showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const typeClasses: Record<ToastType, string> = {
	success: "bg-green-50 border-green-300 text-green-800",
	error: "bg-red-50 border-red-300 text-red-800",
	info: "bg-[#E6F1FB] border-[#B5D4F4] text-[#185FA5]",
};

const typeIcons: Record<ToastType, ReactElement> = {
	success: (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<path d="M20 6L9 17l-5-5" />
		</svg>
	),
	error: (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 8v4m0 4h.01" />
		</svg>
	),
	info: (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 16v-4m0-4h.01" />
		</svg>
	),
};

export function ToastProvider({ children }: { readonly children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const removeToast = useCallback((id: string) => {
		setToasts(prev => prev.filter(t => t.id !== id));
	}, []);

	const showToast = useCallback(
		(message: string, type: ToastType = "info") => {
			const id = Math.random().toString(36).slice(2);
			setToasts(prev => [...prev, { id, message, type }]);
			setTimeout(() => {
				removeToast(id);
			}, 3000);
		},
		[removeToast]
	);

	const contextValue = useMemo(() => ({ showToast }), [showToast]);

	return (
		<ToastContext.Provider value={contextValue}>
			{children}
			<div className="fixed top-4 right-4 z-100 flex flex-col gap-2 pointer-events-none">
				{toasts.map(toast => (
					<div
						key={toast.id}
						className={[
							"pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-md text-sm min-w-65 max-w-xs",
							"animate-[slideIn_0.2s_ease-out]",
							typeClasses[toast.type],
						].join(" ")}
					>
						<span className="shrink-0">{typeIcons[toast.type]}</span>
						<span className="flex-1">{toast.message}</span>
						<button
							onClick={() => removeToast(toast.id)}
							className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
							aria-label="Fechar"
						>
							<svg
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
							>
								<path d="M18 6L6 18M6 6l12 12" />
							</svg>
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used inside ToastProvider");
	return ctx;
}
