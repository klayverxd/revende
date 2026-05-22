"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const TABS = [
	{ key: "geral", label: "Visão Geral" },
	{ key: "pedidos", label: "Pedidos" },
	{ key: "comissao", label: "Comissão" },
] as const;

type Tab = typeof TABS[number]["key"];

interface Props {
	readonly activeTab: Tab;
	readonly ano: number;
	readonly mes: number;
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function FinanceiroTabNav({ activeTab, ano, mes }: Props) {
	const searchParams = useSearchParams();

	function hrefTab(tab: Tab) {
		const p = new URLSearchParams(searchParams.toString());
		p.set("tab", tab);
		return `/financeiro?${p.toString()}`;
	}

	function hrefPeriodo(dano: number, dmes: number) {
		const p = new URLSearchParams(searchParams.toString());
		p.set("ano", String(dano));
		p.set("mes", String(dmes));
		return `/financeiro?${p.toString()}`;
	}

	const prevDate = new Date(ano, mes - 2, 1);
	const nextDate = new Date(ano, mes, 1);

	return (
		<div className="flex items-center justify-between gap-3 flex-wrap">
			<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1 w-fit">
				{TABS.map(t => (
					<Link
						key={t.key}
						href={hrefTab(t.key)}
						className={[
							"rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
							activeTab === t.key
								? "bg-[#185FA5] text-white"
								: "text-gray-700 hover:bg-[#E6F1FB]",
						].join(" ")}
					>
						{t.label}
					</Link>
				))}
			</div>

			{activeTab !== "comissao" && (
				<div className="flex items-center gap-1.5">
					<Link
						href={hrefPeriodo(prevDate.getFullYear(), prevDate.getMonth() + 1)}
						className="px-2.5 py-1.5 rounded-lg border border-[#B5D4F4] text-sm text-[#185FA5] hover:bg-[#E6F1FB] transition-colors"
					>
						←
					</Link>
					<span className="px-3 py-1.5 rounded-lg bg-[#185FA5] text-white text-sm font-semibold min-w-24 text-center">
						{MESES[mes - 1]} {ano}
					</span>
					<Link
						href={hrefPeriodo(nextDate.getFullYear(), nextDate.getMonth() + 1)}
						className="px-2.5 py-1.5 rounded-lg border border-[#B5D4F4] text-sm text-[#185FA5] hover:bg-[#E6F1FB] transition-colors"
					>
						→
					</Link>
				</div>
			)}
		</div>
	);
}
