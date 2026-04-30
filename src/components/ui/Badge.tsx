import { HTMLAttributes } from "react";

type Variant = "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	readonly variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
	success: "bg-green-50 text-green-800",
	warning: "bg-amber-50 text-amber-800",
	danger: "bg-red-50 text-red-800",
	info: "bg-[#E6F1FB] text-[#185FA5]",
	neutral: "bg-gray-100 text-gray-600",
};

export default function Badge({
	variant = "neutral",
	children,
	className = "",
	...rest
}: Readonly<BadgeProps>) {
	return (
		<span
			className={[
				"inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
				variantClasses[variant],
				className,
			].join(" ")}
			{...rest}
		>
			{children}
		</span>
	);
}
