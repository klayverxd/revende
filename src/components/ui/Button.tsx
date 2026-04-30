"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
	primary:
		"bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:bg-[#185FA5]/50",
	secondary:
		"bg-white border border-[#B5D4F4] text-[#185FA5] hover:bg-[#E6F1FB] disabled:opacity-50",
	ghost: "text-[#185FA5] hover:bg-[#E6F1FB] disabled:opacity-50",
	danger:
		"bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
	sm: "h-7 px-3 text-xs rounded",
	md: "h-9 px-4 text-sm rounded-md",
	lg: "h-11 px-6 text-base rounded-lg",
};

const Spinner = () => (
	<svg
		className="animate-spin -ml-1 mr-2 h-4 w-4"
		xmlns="http://www.w3.org/2000/svg"
		fill="none"
		viewBox="0 0 24 24"
	>
		<circle
			className="opacity-25"
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			strokeWidth="4"
		/>
		<path
			className="opacity-75"
			fill="currentColor"
			d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
		/>
	</svg>
);

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			variant = "primary",
			size = "md",
			loading = false,
			disabled,
			children,
			className = "",
			...rest
		},
		ref
	) => {
		return (
			<button
				ref={ref}
				disabled={disabled || loading}
				className={[
					"inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#185FA5] focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed",
					variantClasses[variant],
					sizeClasses[size],
					className,
				].join(" ")}
				{...rest}
			>
				{loading && <Spinner />}
				{children}
			</button>
		);
	}
);

Button.displayName = "Button";

export default Button;
