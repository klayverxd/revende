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
	status: "ABERTO" | "CONFERIDO" | "ENCERRADO";
}

interface Props {
	readonly envios: EnvioRow[];
}

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function variantFromStatus(status: EnvioRow["status"]) {
	if (status === "ABERTO") return "warning" as const;
	if (status === "CONFERIDO") return "info" as const;
	return "success" as const;
}

export default function EnviosTable({ envios }: Props) {
	const [filtro, setFiltro] = useState<"TODOS" | EnvioRow["status"]>("TODOS");
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		let result =
			filtro === "TODOS" ? envios : envios.filter(e => e.status === filtro);
		if (search.trim()) {
			const term = search.toLowerCase();
			result = result.filter(e =>
				e.revendedor_nome.toLowerCase().includes(term)
			);
		}
		return result;
	}, [envios, filtro, search]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="inline-flex w-fit rounded-lg border border-[#B5D4F4] bg-white p-1">
					{[
						{ key: "TODOS", label: "Todos" },
						{ key: "ABERTO", label: "Aberto" },
						{ key: "CONFERIDO", label: "Conferido" },
						{ key: "ENCERRADO", label: "Encerrado" },
					].map(f => (
						<button
							key={f.key}
							type="button"
							onClick={() => setFiltro(f.key as typeof filtro)}
							className={[
								"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
								filtro === f.key
									? "bg-[#185FA5] text-white"
									: "text-gray-600 hover:bg-[#E6F1FB]",
							].join(" ")}
						>
							{f.label}
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
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Revendedor
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Data
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Itens
							</th>
							<th className="px-3 py-2.5 text-center font-medium text-gray-600">
								Status
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
									colSpan={5}
									className="px-3 py-10 text-center text-gray-600"
								>
									Nenhum envio encontrado.
								</td>
							</tr>
						)}
						{filtered.map(e => (
							<tr
								key={e.envio_id}
								className="border-b border-[#B5D4F4] last:border-0"
							>
								<td className="px-3 py-2.5 font-medium text-gray-900">
									{e.revendedor_nome}
								</td>
								<td className="px-3 py-2.5 text-gray-700">
									{fmtDate(e.data_envio)}
								</td>
								<td className="px-3 py-2.5 text-right text-gray-700">
									{e.total_itens} prod. · {e.total_unidades} un.
								</td>
								<td className="px-3 py-2.5 text-center">
									<Badge variant={variantFromStatus(e.status)}>
										{e.status === "ABERTO"
											? "Aberto"
											: e.status === "CONFERIDO"
												? "Conferido"
												: "Encerrado"}
									</Badge>
								</td>
								<td className="px-3 py-2.5 text-right">
									<RowActionsMenu
										label={`Envio ${e.envio_id.slice(0, 8)}`}
										actions={[
											{ label: "Ver detalhes", href: `/envios/${e.envio_id}` },
											...(e.status === "ABERTO"
												? [
														{
															label: "Conferir envio",
															href: `/conferencias/revendedor/${e.revendedor_id}`,
														},
													]
												: []),
											...(e.status === "CONFERIDO" || e.status === "ENCERRADO"
												? [
														{
															label: "Registrar devolução",
															href: `/envios/${e.envio_id}/devolucao`,
														},
														{
															label: "Ver acerto",
															href: `/financeiro`,
														},
													]
												: []),
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
