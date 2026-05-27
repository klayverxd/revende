"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Props {
	readonly revendedorId: string;
}

export default function RevendedorTabs({ revendedorId }: Props) {
	const pathname = usePathname();

	const tabs = [
		{ label: "Visão geral", href: `/revendedores/${revendedorId}` },
		{ label: "Preços", href: `/revendedores/${revendedorId}/precos` },
		{ label: "Histórico", href: `/revendedores/${revendedorId}/historico` },
		{ label: "Cadastro", href: `/revendedores/${revendedorId}/cadastro` },
	];

	return (
		<div className="flex border-b border-[#B5D4F4] gap-1">
			{tabs.map(tab => {
				const isActive =
					tab.href === `/revendedores/${revendedorId}`
						? pathname === tab.href
						: pathname.startsWith(tab.href);
				return (
					<Link
						key={tab.href}
						href={tab.href}
						className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
							isActive
								? "border-[#185FA5] text-[#185FA5]"
								: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
						}`}
					>
						{tab.label}
					</Link>
				);
			})}
		</div>
	);
}
