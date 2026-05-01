"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string;
	error?: string;
	hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	({ label, error, hint, id, className = "", type, step, ...rest }, ref) => {
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
						className="text-[13px] text-gray-700 font-medium"
					>
						{label}
						{rest.required && <span className="text-red-500 ml-1">*</span>}
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
