"use client";

import { useMemo, useState } from "react";
import { RowActionsMenu } from "@/components/ui";

export interface VendaDiretaRow {
	venda_id: string;
	data_venda: string;
	total_itens: number;
	canal: "PRESENCIAL" | "WHATSAPP" | "FEIRA" | "EVENTO" | "INSTAGRAM" | "OUTRO";
	forma_pagamento: "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";
	valor_total: number;
}

interface Props {
	readonly vendas: VendaDiretaRow[];
}

type Periodo = "HOJE" | "SEMANA" | "MES";
type CanalFiltro = "TODOS" | VendaDiretaRow["canal"];

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isNoPeriodo(dataVenda: string, periodo: Periodo) {
	const hoje = new Date();
	const d = new Date(`${dataVenda}T00:00:00`);
	const diffDias = Math.floor(
		(hoje.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
	);
	if (periodo === "HOJE") return diffDias === 0;
	if (periodo === "SEMANA") return diffDias <= 7;
	return diffDias <= 31;
}

export default function VendaDiretaTable({ vendas }: Props) {
	const [periodo, setPeriodo] = useState<Periodo>("MES");
	const [canal, setCanal] = useState<CanalFiltro>("TODOS");

	const filtered = useMemo(() => {
		return vendas.filter(v => {
			if (!isNoPeriodo(v.data_venda, periodo)) return false;
			if (canal !== "TODOS" && v.canal !== canal) return false;
			return true;
		});
	}, [vendas, periodo, canal]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1">
					{[
						{ key: "HOJE", label: "Hoje" },
						{ key: "SEMANA", label: "Semana" },
						{ key: "MES", label: "Mes" },
					].map(p => (
						<button
							key={p.key}
							type="button"
							onClick={() => setPeriodo(p.key as Periodo)}
							className={[
								"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
								periodo === p.key
									? "bg-[#185FA5] text-white"
									: "text-gray-700 hover:bg-[#E6F1FB]",
							].join(" ")}
						>
							{p.label}
						</button>
					))}
				</div>

				<select
					value={canal}
					onChange={e => setCanal(e.target.value as CanalFiltro)}
					className="h-9 rounded-md border border-[#B5D4F4] px-3 text-sm text-gray-900 bg-white"
				>
					<option value="TODOS">Todos os canais</option>
					<option value="PRESENCIAL">Presencial</option>
					<option value="WHATSAPP">WhatsApp</option>
					<option value="FEIRA">Feira</option>
					<option value="EVENTO">Evento</option>
					<option value="INSTAGRAM">Instagram</option>
					<option value="OUTRO">Outro</option>
				</select>
			</div>

			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Data
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Itens
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Canal
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Pagamento
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Valor
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Acoes
							</th>
						</tr>
					</thead>
					<tbody>
						{filtered.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="px-3 py-10 text-center text-gray-600"
								>
									Nenhuma venda no filtro selecionado.
								</td>
							</tr>
						)}
						{filtered.map(v => (
							<tr
								key={v.venda_id}
								className="border-b border-[#B5D4F4] last:border-0"
							>
								<td className="px-3 py-2.5 text-gray-700">
									{fmtDate(v.data_venda)}
								</td>
								<td className="px-3 py-2.5 text-right text-gray-700">
									{v.total_itens}
								</td>
								<td className="px-3 py-2.5 text-gray-700">{v.canal}</td>
								<td className="px-3 py-2.5 text-gray-700">
									{v.forma_pagamento}
								</td>
								<td className="px-3 py-2.5 text-right font-semibold text-gray-900">
									{fmtCurrency(v.valor_total)}
								</td>
								<td className="px-3 py-2.5 text-right">
									<RowActionsMenu
										actions={[
											{
												label: "Ver detalhes",
												href: `/venda-direta/${v.venda_id}`,
											},
										]}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
