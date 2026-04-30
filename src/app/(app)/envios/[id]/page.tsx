import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button } from "@/components/ui";

interface Props {
	params: Promise<{ id: string }>;
}

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusVariant(status: string) {
	if (status === "ABERTO") return "warning" as const;
	if (status === "CONFERIDO") return "info" as const;
	return "success" as const;
}

export default async function EnvioDetalhePage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: envio, error: envioError } = await supabase
		.from("envio")
		.select(
			"envio_id, data_envio, status, observacao, revendedor:revendedor_id(nome, telefone)"
		)
		.eq("envio_id", id)
		.is("deleted_at", null)
		.single();

	if (envioError || !envio) notFound();

	const { data: itensRaw } = await supabase
		.from("envio_item")
		.select(
			"envio_item_id, qtd_enviada, qtd_vendida, qtd_devolvida, preco_unitario, valor_minimo_unit, modelo_acerto, modelo:modelo_id(nome, codigo)"
		)
		.eq("envio_id", id)
		.is("deleted_at", null);

	const { data: acertoRaw } = await supabase
		.from("acerto")
		.select(
			"acerto_id, modelo_acerto, comissao_calculada, valor_liquido, valor_a_receber, valor_repassado, status, data_recebimento, observacao"
		)
		.eq("envio_id", id)
		.is("deleted_at", null)
		.maybeSingle();

	const revendedor = envio.revendedor as unknown as {
		nome: string;
		telefone: string | null;
	} | null;

	const itens = (itensRaw ?? []).map(i => {
		const modelo = i.modelo as unknown as {
			nome: string;
			codigo: string | null;
		} | null;
		const qtdEnviada = (i.qtd_enviada as number) ?? 0;
		const qtdVendida = (i.qtd_vendida as number | null) ?? 0;
		const qtdDevolvida = (i.qtd_devolvida as number | null) ?? 0;
		const emConsignacao = qtdEnviada - qtdVendida - qtdDevolvida;
		return {
			envio_item_id: i.envio_item_id as string,
			nome: modelo?.nome ?? "Produto",
			codigo: modelo?.codigo ?? null,
			modelo_acerto: (i.modelo_acerto as string | null) ?? "COMISSAO",
			qtd_enviada: qtdEnviada,
			qtd_vendida: qtdVendida,
			qtd_devolvida: qtdDevolvida,
			em_consignacao: emConsignacao,
			preco_unitario: (i.preco_unitario as number | null) ?? null,
			valor_minimo_unit: (i.valor_minimo_unit as number | null) ?? null,
		};
	});

	const statusEnvio = envio.status as string;
	const totalEnviado = itens.reduce((s, i) => s + i.qtd_enviada, 0);
	const totalVendido = itens.reduce((s, i) => s + i.qtd_vendida, 0);
	const totalDevolvido = itens.reduce((s, i) => s + i.qtd_devolvida, 0);
	const totalConsignado = itens.reduce((s, i) => s + i.em_consignacao, 0);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						Detalhes do envio
					</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Envio de {fmtDate(envio.data_envio as string)} para{" "}
						{revendedor?.nome ?? "Revendedor"}
					</p>
				</div>
				<Link href="/envios">
					<Button variant="secondary" size="sm">
						Voltar
					</Button>
				</Link>
			</div>

			{/* Info cards */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
					<p className="text-xs text-gray-500 mb-1">Revendedor</p>
					<p className="text-sm font-semibold text-gray-900">
						{revendedor?.nome ?? "-"}
					</p>
					{revendedor?.telefone && (
						<p className="text-xs text-gray-500 mt-0.5">
							{revendedor.telefone}
						</p>
					)}
				</div>
				<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
					<p className="text-xs text-gray-500 mb-1">Data do envio</p>
					<p className="text-sm font-semibold text-gray-900">
						{fmtDate(envio.data_envio as string)}
					</p>
				</div>
				<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
					<p className="text-xs text-gray-500 mb-1">Status</p>
					<Badge variant={statusVariant(statusEnvio)}>{statusEnvio}</Badge>
				</div>
				<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
					<p className="text-xs text-gray-500 mb-1">Itens no envio</p>
					<p className="text-sm font-semibold text-gray-900">
						{itens.length} produto{itens.length !== 1 ? "s" : ""}
					</p>
				</div>
			</div>

			{/* Items table */}
			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
				<div className="px-4 py-3 border-b border-[#B5D4F4]">
					<h2 className="text-sm font-semibold text-gray-800">Itens</h2>
				</div>
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Produto
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Enviado
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Vendido
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Devolvido
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Em consignação
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Preço unit.
							</th>
						</tr>
					</thead>
					<tbody>
						{itens.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="px-3 py-10 text-center text-gray-400"
								>
									Nenhum item encontrado.
								</td>
							</tr>
						)}
						{itens.map(item => {
							const preco =
								item.modelo_acerto === "VALOR_MINIMO"
									? item.valor_minimo_unit
									: item.preco_unitario;
							return (
								<tr
									key={item.envio_item_id}
									className="border-b border-[#B5D4F4] last:border-0"
								>
									<td className="px-3 py-2.5">
										<div className="font-medium text-gray-900">{item.nome}</div>
										{item.codigo && (
											<div className="text-xs text-gray-500 font-mono">
												{item.codigo}
											</div>
										)}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{item.qtd_enviada}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{item.qtd_vendida}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{item.qtd_devolvida}
									</td>
									<td className="px-3 py-2.5 text-right font-semibold text-gray-900">
										{item.em_consignacao}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{preco != null ? fmtCurrency(preco) : "-"}
									</td>
								</tr>
							);
						})}
					</tbody>
					<tfoot>
						<tr className="border-t border-[#B5D4F4] bg-[#F4F8FD]">
							<td className="px-3 py-2.5 text-sm font-semibold text-gray-700">
								Total
							</td>
							<td className="px-3 py-2.5 text-right font-semibold text-gray-800">
								{totalEnviado}
							</td>
							<td className="px-3 py-2.5 text-right font-semibold text-gray-800">
								{totalVendido}
							</td>
							<td className="px-3 py-2.5 text-right font-semibold text-gray-800">
								{totalDevolvido}
							</td>
							<td className="px-3 py-2.5 text-right font-semibold text-gray-900">
								{totalConsignado}
							</td>
							<td />
						</tr>
					</tfoot>
				</table>
			</div>

			{/* Acerto */}
			{acertoRaw && (
				<div className="bg-white rounded-xl border border-[#B5D4F4]">
					<div className="px-4 py-3 border-b border-[#B5D4F4]">
						<h2 className="text-sm font-semibold text-gray-800">
							Acerto financeiro
						</h2>
					</div>
					<div className="px-4 py-4 flex flex-col gap-3">
						<div className="flex flex-wrap gap-6">
							{acertoRaw.modelo_acerto === "COMISSAO" ? (
								<>
									<div>
										<p className="text-xs text-gray-500">
											Valor total da venda
										</p>
										<p className="text-sm font-semibold text-gray-900">
											{fmtCurrency(
												((acertoRaw.valor_liquido as number) ?? 0) +
													((acertoRaw.comissao_calculada as number) ?? 0)
											)}
										</p>
									</div>
									<div>
										<p className="text-xs text-gray-500">
											Comissão do revendedor
										</p>
										<p className="text-sm font-semibold text-gray-900">
											{fmtCurrency(
												(acertoRaw.comissao_calculada as number | null) ?? 0
											)}
										</p>
									</div>
									<div>
										<p className="text-xs text-gray-500">Valor líquido</p>
										<p className="text-sm font-semibold text-gray-900">
											{fmtCurrency(
												(acertoRaw.valor_liquido as number | null) ?? 0
											)}
										</p>
									</div>
								</>
							) : (
								<div>
									<p className="text-xs text-gray-500">Valor a receber</p>
									<p className="text-sm font-semibold text-gray-900">
										{fmtCurrency(
											(acertoRaw.valor_a_receber as number | null) ?? 0
										)}
									</p>
								</div>
							)}
							{acertoRaw.valor_repassado != null && (
								<div>
									<p className="text-xs text-gray-500">Valor repassado</p>
									<p className="text-sm font-semibold text-gray-900">
										{fmtCurrency(acertoRaw.valor_repassado as number)}
									</p>
								</div>
							)}
							<div>
								<p className="text-xs text-gray-500">Status do acerto</p>
								<Badge
									variant={
										acertoRaw.status === "RECEBIDO" ? "success" : "warning"
									}
								>
									{acertoRaw.status as string}
								</Badge>
							</div>
							{acertoRaw.data_recebimento && (
								<div>
									<p className="text-xs text-gray-500">Recebido em</p>
									<p className="text-sm font-semibold text-gray-900">
										{fmtDate(acertoRaw.data_recebimento as string)}
									</p>
								</div>
							)}
						</div>
						{acertoRaw.observacao && (
							<p className="text-sm text-gray-600 border-t border-[#B5D4F4] pt-3">
								{acertoRaw.observacao as string}
							</p>
						)}
					</div>
				</div>
			)}

			{/* Observação do envio */}
			{envio.observacao && (
				<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
					<p className="text-xs text-gray-500 mb-1">Observação</p>
					<p className="text-sm text-gray-700">{envio.observacao as string}</p>
				</div>
			)}

			{/* Actions */}
			<div className="flex gap-2">
				{statusEnvio === "ABERTO" && (
					<Link href={`/conferencias/${id}`}>
						<Button size="sm">Conferir envio</Button>
					</Link>
				)}
				{(statusEnvio === "CONFERIDO" || statusEnvio === "ENCERRADO") && (
					<Link href={`/envios/${id}/devolucao`}>
						<Button variant="secondary" size="sm">
							Registrar devolução
						</Button>
					</Link>
				)}
			</div>
		</div>
	);
}
