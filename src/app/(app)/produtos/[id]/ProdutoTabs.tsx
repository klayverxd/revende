"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
	readonly modeloId: string;
}

export default function ProdutoTabs({ modeloId }: Props) {
	const pathname = usePathname();

	const tabs = [
		{ label: "Dados gerais", href: `/produtos/${modeloId}` },
		{
			label: "Preços por revendedor",
			href: `/produtos/${modeloId}/precos/revendedor`,
		},
	];

	return (
		<div className="flex border-b border-[#B5D4F4] gap-0">
			{tabs.map(tab => {
				const isActive =
					tab.href === `/produtos/${modeloId}`
						? pathname === tab.href
						: pathname.startsWith(tab.href);

				return (
					<Link
						key={tab.href}
						href={tab.href}
						className={[
							"px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
							isActive
								? "border-[#185FA5] text-[#185FA5]"
								: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
						].join(" ")}
					>
						{tab.label}
					</Link>
				);
			})}
		</div>
	);
}
