"use client";

import { useMemo, useState } from "react";
import { Badge, RowActionsMenu } from "@/components/ui";

export interface EnvioRow {
	envio_id: string;
	revendedor_id: string;
	revendedor_nome: string;
	data_envio: string;
	total_itens: number;
	total_unidades: number;
	total_restante: number;
	status: "ABERTO" | "CONFERIDO" | "ENCERRADO";
}

type Filtro = "TODOS" | "COM_ITENS" | "AG_PAGAMENTO" | "ENCERRADO";

interface Props {
	readonly envios: EnvioRow[];
}

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function getSituacao(e: EnvioRow): "com_itens" | "ag_pagamento" | "encerrado" {
	if (e.total_restante > 0) return "com_itens";
	if (e.status === "ENCERRADO") return "encerrado";
	return "ag_pagamento";
}

export default function EnviosTable({ envios }: Props) {
	const [filtro, setFiltro] = useState<Filtro>("TODOS");
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		let result = envios;
		if (filtro === "COM_ITENS") result = envios.filter(e => e.total_restante > 0);
		else if (filtro === "AG_PAGAMENTO") result = envios.filter(e => e.total_restante === 0 && e.status !== "ENCERRADO");
		else if (filtro === "ENCERRADO") result = envios.filter(e => e.status === "ENCERRADO");
		if (search.trim()) {
			const term = search.toLowerCase();
			result = result.filter(e => e.revendedor_nome.toLowerCase().includes(term));
		}
		return result;
	}, [envios, filtro, search]);

	const counts = useMemo(() => ({
		com_itens: envios.filter(e => e.total_restante > 0).length,
		ag_pagamento: envios.filter(e => e.total_restante === 0 && e.status !== "ENCERRADO").length,
		encerrado: envios.filter(e => e.status === "ENCERRADO").length,
	}), [envios]);

	const tabs: { key: Filtro; label: string; count?: number }[] = [
		{ key: "TODOS", label: "Todos", count: envios.length },
		{ key: "COM_ITENS", label: "Com itens", count: counts.com_itens },
		{ key: "AG_PAGAMENTO", label: "Ag. pagamento", count: counts.ag_pagamento },
		{ key: "ENCERRADO", label: "Encerrado", count: counts.encerrado },
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="inline-flex w-fit rounded-lg border border-[#B5D4F4] bg-white p-1 gap-0.5 flex-wrap">
					{tabs.map(t => (
						<button
							key={t.key}
							type="button"
							onClick={() => setFiltro(t.key)}
							className={[
								"rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5",
								filtro === t.key
									? "bg-[#185FA5] text-white"
									: "text-gray-600 hover:bg-[#E6F1FB]",
							].join(" ")}
						>
							{t.label}
							{t.count !== undefined && t.count > 0 && (
								<span className={[
									"inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold",
									filtro === t.key ? "bg-white/20 text-white" : "bg-[#E6F1FB] text-[#185FA5]",
								].join(" ")}>
									{t.count}
								</span>
							)}
						</button>
					))}
				</div>
				<input
					type="search"
					placeholder="Buscar por revendedor..."
					value={search}
					onChange={e => setSearch(e.target.value)}
					className="h-9 w-56 rounded-md border border-[#B5D4F4] px-3 text-sm text-gray-900 bg-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
				/>
			</div>

			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">Revendedor</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">Data</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">Itens</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">Situação</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">Ações</th>
						</tr>
					</thead>
					<tbody>
						{filtered.length === 0 && (
							<tr>
								<td colSpan={5} className="px-3 py-10 text-center text-gray-600">
									Nenhum envio encontrado.
								</td>
							</tr>
						)}
						{filtered.map(e => {
							const situacao = getSituacao(e);
							return (
								<tr key={e.envio_id} className="border-b border-[#B5D4F4] last:border-0">
									<td className="px-3 py-2.5 font-medium text-gray-900">{e.revendedor_nome}</td>
									<td className="px-3 py-2.5 text-gray-700">{fmtDate(e.data_envio)}</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{e.total_itens} prod. · {e.total_unidades} un.
									</td>
									<td className="px-3 py-2.5">
										{situacao === "com_itens" && (
											<Badge variant="warning">
												{e.total_restante} un. com revendedor
											</Badge>
										)}
										{situacao === "ag_pagamento" && (
											<Badge variant="info">Aguardando pagamento</Badge>
										)}
										{situacao === "encerrado" && (
											<Badge variant="success">Encerrado</Badge>
										)}
									</td>
									<td className="px-3 py-2.5 text-right">
										<RowActionsMenu
											label={`Envio ${e.envio_id.slice(0, 8)}`}
											actions={[
												{ label: "Ver detalhes", href: `/envios/${e.envio_id}` },
												...(e.total_restante > 0
													? [{ label: "Conferir", href: `/conferencias/revendedor/${e.revendedor_id}` }]
													: []),
												...(situacao === "com_itens"
													? []
													: [
															{ label: "Registrar devolução", href: `/envios/${e.envio_id}/devolucao` },
															{ label: "Ver acerto", href: `/financeiro` },
														]),
											]}
										/>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
