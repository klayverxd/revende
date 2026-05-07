"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	hint?: string;
	tooltip?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{ label, error, hint, tooltip, id, className = "", type, step, ...rest },
		ref
	) => {
		const inputId = id ?? label?.toLowerCase().split(/\s+/).join("-");

		// On mobile, type="number" is hard to edit (no spinner, can't select/clear).
		// Use type="text" + inputMode so the numeric keyboard still appears.
		const isNumeric = type === "number";
		const hasDecimal =
			isNumeric && step !== undefined && String(step).includes(".");
		const resolvedType = isNumeric ? "text" : type;
		let resolvedInputMode = rest.inputMode;
		if (isNumeric) {
			resolvedInputMode = hasDecimal ? "decimal" : "numeric";
		}

		return (
			<div className="flex flex-col gap-1">
				{label && (
					<label
						htmlFor={inputId}
						className="text-[13px] text-gray-700 font-medium inline-flex items-center gap-1"
					>
						{label}
						{rest.required && <span className="text-red-500 ml-1">*</span>}
						{tooltip && (
							<span className="group relative inline-flex items-center cursor-default">
								<svg
									className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#378ADD] transition-colors"
									viewBox="0 0 20 20"
									fill="currentColor"
								>
									<path
										fillRule="evenodd"
										d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
										clipRule="evenodd"
									/>
								</svg>
								<span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-50 rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center leading-snug">
									{tooltip}
								</span>
							</span>
						)}
					</label>
				)}
				<input
					ref={ref}
					id={inputId}
					type={resolvedType}
					step={step}
					inputMode={resolvedInputMode}
					className={[
						"w-full rounded-md border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 bg-white transition-colors",
						"focus:outline-none focus:ring-1",
						error
							? "border-red-400 focus:border-red-500 focus:ring-red-500"
							: "border-[#B5D4F4] focus:border-[#185FA5] focus:ring-[#185FA5]",
						className,
					].join(" ")}
					{...rest}
				/>
				{error && <p className="text-[12px] text-red-600">{error}</p>}
				{hint && !error && <p className="text-[12px] text-gray-500">{hint}</p>}
			</div>
		);
	}
);

Input.displayName = "Input";

export default Input;
