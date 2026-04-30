"use client";

import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectOption {
	value: string;
	label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	label?: string;
	error?: string;
	options: SelectOption[];
	placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
	(
		{ label, error, options, placeholder, id, className = "", ...rest },
		ref
	) => {
		const selectId = id ?? label?.toLowerCase().split(/\s+/).join("-");

		return (
			<div className="flex flex-col gap-1">
				{label && (
					<label
						htmlFor={selectId}
						className="text-[13px] text-gray-600 font-medium"
					>
						{label}
						{rest.required && <span className="text-red-500 ml-1">*</span>}
					</label>
				)}
				<div className="relative">
					<select
						ref={ref}
						id={selectId}
						className={[
							"w-full appearance-none rounded-md border px-3 py-2 text-sm text-gray-900 bg-white pr-8 transition-colors",
							"focus:outline-none focus:ring-1",
							error
								? "border-red-400 focus:border-red-500 focus:ring-red-500"
								: "border-[#B5D4F4] focus:border-[#185FA5] focus:ring-[#185FA5]",
							className,
						].join(" ")}
						{...rest}
					>
						{placeholder && (
							<option value="" disabled>
								{placeholder}
							</option>
						)}
						{options.map(opt => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
					{/* Chevron icon */}
					<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
						>
							<path d="M6 9l6 6 6-6" />
						</svg>
					</div>
				</div>
				{error && <p className="text-[12px] text-red-600">{error}</p>}
			</div>
		);
	}
);

Select.displayName = "Select";

export default Select;
