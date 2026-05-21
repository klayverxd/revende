import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { fmtData } from "@/lib/utils/data";

interface Props {
	readonly params: Promise<{ id: string }>;
}

function fmtBRL(v: number | null | undefined) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(num: number, den: number) {
	if (!den) return "—";
	return `${Math.round((num / den) * 100)}%`;
}

export default async function RevendedorHistoricoPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, nome, modelo_acerto, comissao_pct, comissao_fixa, ativo")
		.eq("revendedor_id", id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	const [{ data: enviosRaw }, { data: acertosRaw }] = await Promise.all([
		supabase
			.from("envio")
			.select(
				`envio_id, data_envio, status, observacao,
				itens:envio_item(
					envio_item_id, qtd_enviada, qtd_vendida, qtd_devolvida,
					preco_unitario, valor_total_venda, valor_a_receber, modo_valor,
					modelo:modelo_id(codigo, nome)
				)`
			)
			.eq("revendedor_id", id)
			.is("deleted_at", null)
			.order("data_envio", { ascending: false }),
		supabase
			.from("acerto")
			.select(
				"acerto_id, envio_id, status, modelo_acerto, valor_a_receber, valor_liquido, comissao_calculada, valor_repassado, data_recebimento, observacao, created_at"
			)
			.eq("revendedor_id", id)
			.order("created_at", { ascending: false }),
	]);

	const envios = (enviosRaw ?? []) as Array<{
		envio_id: string;
		data_envio: string;
		status: string;
		observacao: string | null;
		itens: Array<{
			envio_item_id: string;
			qtd_enviada: number;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
			preco_unitario: number | null;
			valor_total_venda: number | null;
			valor_a_receber: number | null;
			modo_valor: string | null;
			modelo: { codigo: string; nome: string } | null;
		}>;
	}>;

	const acertos = (acertosRaw ?? []) as Array<{
		acerto_id: string;
		envio_id: string | null;
		status: string;
		modelo_acerto: string;
		valor_a_receber: number | null;
		valor_liquido: number | null;
		comissao_calculada: number | null;
		valor_repassado: number | null;
		data_recebimento: string | null;
		observacao: string | null;
		created_at: string;
	}>;

	const conferidos = envios.filter(e =>
		["CONFERIDO", "ENCERRADO"].includes(e.status)
	);
	const abertos = envios.filter(e => e.status === "ABERTO");

	// ── Métricas gerais ──────────────────────────────────────────────────────
	const totalEnviado = envios.reduce(
		(s, e) => s + e.itens.reduce((si, i) => si + (i.qtd_enviada ?? 0), 0), 0
	);
	const totalVendido = conferidos.reduce(
		(s, e) => s + e.itens.reduce((si, i) => si + (i.qtd_vendida ?? 0), 0), 0
	);
	const totalDevolvido = conferidos.reduce(
		(s, e) => s + e.itens.reduce((si, i) => si + (i.qtd_devolvida ?? 0), 0), 0
	);
	const emConsignacao = abertos.reduce(
		(s, e) => s + e.itens.reduce((si, i) => si + (i.qtd_enviada ?? 0), 0), 0
	);
	const totalAcertos = acertos.length;
	const pendentes = acertos.filter(a => a.status === "PENDENTE").length;

	// ── Ranking de produtos ──────────────────────────────────────────────────
	const prodMap = new Map<string, { nome: string; codigo: string; enviado: number; vendido: number }>();
	for (const envio of envios) {
		for (const item of envio.itens) {
			if (!item.modelo) continue;
			const key = item.modelo.codigo;
			const existing = prodMap.get(key) ?? { nome: item.modelo.nome, codigo: item.modelo.codigo, enviado: 0, vendido: 0 };
			existing.enviado += item.qtd_enviada ?? 0;
			if (["CONFERIDO", "ENCERRADO"].includes(envio.status)) {
				existing.vendido += item.qtd_vendida ?? 0;
			}
			prodMap.set(key, existing);
		}
	}
	const ranking = [...prodMap.values()].sort((a, b) => b.vendido - a.vendido);

	// ── Tempo médio de retorno ───────────────────────────────────────────────
	const temposRetorno: number[] = [];
	for (const acerto of acertos) {
		if (!acerto.data_recebimento || !acerto.envio_id) continue;
		const envio = envios.find(e => e.envio_id === acerto.envio_id);
		if (!envio) continue;
		const dEnvio = new Date(`${envio.data_envio.slice(0, 10)}T00:00:00`);
		const dAcerto = new Date(`${acerto.data_recebimento.slice(0, 10)}T00:00:00`);
		const dias = Math.round((dAcerto.getTime() - dEnvio.getTime()) / 86_400_000);
		if (dias >= 0) temposRetorno.push(dias);
	}
	const tempoMedio = temposRetorno.length
		? Math.round(temposRetorno.reduce((s, d) => s + d, 0) / temposRetorno.length)
		: null;

	// ── Último envio / última atividade ─────────────────────────────────────
	const ultimoEnvio = envios[0]?.data_envio ?? null;

	function statusEnvioVariant(s: string) {
		if (s === "ABERTO") return "info" as const;
		if (s === "CONFERIDO") return "warning" as const;
		return "success" as const;
	}
	function statusEnvioLabel(s: string) {
		if (s === "ABERTO") return "Aberto";
		if (s === "CONFERIDO") return "Conferido";
		return "Encerrado";
	}

	return (
		<div className="flex flex-col gap-8">

			{/* ── Visão geral ── */}
			<section className="flex flex-col gap-3">
				<h2 className="text-base font-semibold text-gray-900">Visão geral</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					<KpiCard label="Total enviado" value={String(totalEnviado)} sub={ultimoEnvio ? `Último: ${fmtData(ultimoEnvio)}` : undefined} />
					<KpiCard label="Total vendido" value={String(totalVendido)} sub={`Taxa: ${pct(totalVendido, totalEnviado - emConsignacao)}`} />
					<KpiCard label="Em consignação" value={String(emConsignacao)} alert={emConsignacao > 0} sub={emConsignacao > 0 ? `${abertos.length} envio${abertos.length > 1 ? "s" : ""} aberto${abertos.length > 1 ? "s" : ""}` : undefined} />
					<KpiCard label="Tempo médio retorno" value={tempoMedio != null ? `${tempoMedio} dias` : "—"} sub={temposRetorno.length ? `${temposRetorno.length} acerto${temposRetorno.length > 1 ? "s" : ""}` : undefined} />
				</div>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					<KpiCard label="Devolvido" value={String(totalDevolvido)} />
					<KpiCard label="Acertos" value={String(totalAcertos)} sub={pendentes > 0 ? `${pendentes} pendente${pendentes > 1 ? "s" : ""}` : undefined} alert={pendentes > 0} />
					<KpiCard label="Modelo acerto" value={(revendedor as { modelo_acerto: string }).modelo_acerto === "COMISSAO" ? "Comissão" : "Valor mínimo"} />
					<KpiCard label="Situação" value={(revendedor as { ativo: boolean }).ativo ? "Ativo" : "Inativo"} />
				</div>
			</section>

			{/* ── Estoque em consignação ── */}
			{abertos.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-base font-semibold text-gray-900">Em consignação agora</h2>
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD] text-xs text-gray-500 uppercase tracking-wide">
									<th className="px-4 py-2.5 text-left font-medium">Envio</th>
									<th className="px-4 py-2.5 text-left font-medium">Produto</th>
									<th className="px-4 py-2.5 text-right font-medium">Qtd</th>
									<th className="px-4 py-2.5 text-right font-medium">Ver</th>
								</tr>
							</thead>
							<tbody>
								{abertos.flatMap(envio =>
									envio.itens.map(item => (
										<tr key={item.envio_item_id} className="border-b border-[#E6F1FB] last:border-0 hover:bg-[#F4F8FD]">
											<td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
												{fmtData(envio.data_envio)}
											</td>
											<td className="px-4 py-2.5">
												{item.modelo ? (
													<span className="font-medium text-gray-900 uppercase">{item.modelo.nome}</span>
												) : (
													<span className="text-gray-400">—</span>
												)}
											</td>
											<td className="px-4 py-2.5 text-right font-semibold text-amber-700">
												{item.qtd_enviada}
											</td>
											<td className="px-4 py-2.5 text-right">
												<Link
													href={`/envios/${envio.envio_id}`}
													className="text-xs text-[#378ADD] hover:underline"
												>
													Abrir
												</Link>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{/* ── Produtos mais vendidos ── */}
			{ranking.length > 0 && (
				<section className="flex flex-col gap-3">
					<h2 className="text-base font-semibold text-gray-900">Produtos</h2>
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD] text-xs text-gray-500 uppercase tracking-wide">
									<th className="px-4 py-2.5 text-left font-medium">Produto</th>
									<th className="px-4 py-2.5 text-right font-medium">Enviado</th>
									<th className="px-4 py-2.5 text-right font-medium">Vendido</th>
									<th className="px-4 py-2.5 text-right font-medium">Taxa</th>
								</tr>
							</thead>
							<tbody>
								{ranking.map(p => (
									<tr key={p.codigo} className="border-b border-[#E6F1FB] last:border-0 hover:bg-[#F4F8FD]">
										<td className="px-4 py-2.5">
											<span className="font-medium text-gray-900 uppercase">{p.nome}</span>
											<span className="text-xs text-gray-400 ml-1 font-mono">{p.codigo}</span>
										</td>
										<td className="px-4 py-2.5 text-right text-gray-700">{p.enviado}</td>
										<td className="px-4 py-2.5 text-right text-gray-700">{p.vendido}</td>
										<td className="px-4 py-2.5 text-right font-medium text-gray-900">
											{pct(p.vendido, p.enviado)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}

			{/* ── Envios ── */}
			<section className="flex flex-col gap-3">
				<h2 className="text-base font-semibold text-gray-900">Envios</h2>
				{envios.length === 0 ? (
					<Empty msg="Nenhum envio registrado." />
				) : (
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD] text-xs text-gray-500 uppercase tracking-wide">
									<th className="px-4 py-2.5 text-left font-medium">Data</th>
									<th className="px-4 py-2.5 text-left font-medium">Produtos</th>
									<th className="px-4 py-2.5 text-right font-medium">Enviados</th>
									<th className="px-4 py-2.5 text-center font-medium">Status</th>
									<th className="px-4 py-2.5 text-right font-medium">Ver</th>
								</tr>
							</thead>
							<tbody>
								{envios.map(envio => {
									const totalEnviadoEnvio = envio.itens.reduce(
										(s, i) => s + (i.qtd_enviada ?? 0), 0
									);
									const nomes = [
										...new Set(
											envio.itens
												.map(i => i.modelo?.nome)
												.filter(Boolean) as string[]
										),
									];
									return (
										<tr key={envio.envio_id} className="border-b border-[#E6F1FB] last:border-0 hover:bg-[#F4F8FD]">
											<td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
												{fmtData(envio.data_envio)}
											</td>
											<td className="px-4 py-2.5 text-gray-700">
												<div className="flex flex-wrap gap-1">
													{nomes.slice(0, 3).map(n => (
														<span key={n} className="text-xs uppercase bg-[#E6F1FB] text-[#185FA5] rounded px-1.5 py-0.5">
															{n}
														</span>
													))}
													{nomes.length > 3 && (
														<span className="text-xs text-gray-400">+{nomes.length - 3}</span>
													)}
												</div>
											</td>
											<td className="px-4 py-2.5 text-right text-gray-700">{totalEnviadoEnvio}</td>
											<td className="px-4 py-2.5 text-center">
												<Badge variant={statusEnvioVariant(envio.status)}>
													{statusEnvioLabel(envio.status)}
												</Badge>
											</td>
											<td className="px-4 py-2.5 text-right">
												<Link
													href={`/envios/${envio.envio_id}`}
													className="text-xs text-[#378ADD] hover:underline"
												>
													Abrir
												</Link>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* ── Conferências ── */}
			<section className="flex flex-col gap-3">
				<h2 className="text-base font-semibold text-gray-900">Conferências</h2>
				{conferidos.length === 0 ? (
					<Empty msg="Nenhuma conferência registrada." />
				) : (
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD] text-xs text-gray-500 uppercase tracking-wide">
									<th className="px-4 py-2.5 text-left font-medium">Data envio</th>
									<th className="px-4 py-2.5 text-left font-medium">Produto</th>
									<th className="px-4 py-2.5 text-right font-medium">Enviado</th>
									<th className="px-4 py-2.5 text-right font-medium">Vendido</th>
									<th className="px-4 py-2.5 text-right font-medium">Devolvido</th>
									<th className="px-4 py-2.5 text-right font-medium">Valor</th>
								</tr>
							</thead>
							<tbody>
								{conferidos.flatMap(envio =>
									envio.itens.map(item => {
										const valor =
											item.valor_total_venda ?? item.valor_a_receber ?? null;
										return (
											<tr key={item.envio_item_id} className="border-b border-[#E6F1FB] last:border-0 hover:bg-[#F4F8FD]">
												<td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
													{fmtData(envio.data_envio)}
												</td>
												<td className="px-4 py-2.5">
													{item.modelo ? (
														<div>
															<span className="font-medium text-gray-900 uppercase">
																{item.modelo.nome}
															</span>
															<span className="text-xs text-gray-400 ml-1 font-mono">
																{item.modelo.codigo}
															</span>
														</div>
													) : (
														<span className="text-gray-400">—</span>
													)}
												</td>
												<td className="px-4 py-2.5 text-right text-gray-700">
													{item.qtd_enviada}
												</td>
												<td className="px-4 py-2.5 text-right text-gray-700">
													{item.qtd_vendida ?? "—"}
												</td>
												<td className="px-4 py-2.5 text-right text-gray-700">
													{item.qtd_devolvida ?? "—"}
												</td>
												<td className="px-4 py-2.5 text-right font-medium text-gray-900">
													{fmtBRL(valor)}
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{/* ── Financeiro ── */}
			<section className="flex flex-col gap-3">
				<h2 className="text-base font-semibold text-gray-900">Financeiro</h2>
				{acertos.length === 0 ? (
					<Empty msg="Nenhum acerto registrado." />
				) : (
					<>
						{/* Resumo */}
						<div className="grid grid-cols-2 md:grid-cols-3 gap-3">
							{(() => {
								const pendente = acertos
									.filter(a => a.status === "PENDENTE")
									.reduce((s, a) => s + (a.modelo_acerto === "COMISSAO"
										? (a.valor_liquido ?? 0)
										: (a.valor_a_receber ?? 0)), 0);
								const recebido = acertos
									.filter(a => a.status === "RECEBIDO")
									.reduce((s, a) => s + (a.valor_repassado ?? 0), 0);
								const total = acertos.reduce((s, a) => s + (a.modelo_acerto === "COMISSAO"
									? (a.valor_liquido ?? 0)
									: (a.valor_a_receber ?? 0)), 0);
								return (
									<>
										<KpiCard label="Total a receber" value={fmtBRL(total)} />
										<KpiCard label="Pendente" value={fmtBRL(pendente)} alert={pendente > 0} />
										<KpiCard label="Recebido" value={fmtBRL(recebido)} />
									</>
								);
							})()}
						</div>

						{/* Tabela */}
						<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD] text-xs text-gray-500 uppercase tracking-wide">
										<th className="px-4 py-2.5 text-left font-medium">Data</th>
										<th className="px-4 py-2.5 text-left font-medium">Modelo</th>
										<th className="px-4 py-2.5 text-right font-medium">Valor</th>
										<th className="px-4 py-2.5 text-right font-medium">Repassado</th>
										<th className="px-4 py-2.5 text-center font-medium">Status</th>
										<th className="px-4 py-2.5 text-left font-medium">Envio</th>
									</tr>
								</thead>
								<tbody>
									{acertos.map(acerto => {
										const valor = acerto.modelo_acerto === "COMISSAO"
											? acerto.valor_liquido
											: acerto.valor_a_receber;
										const envio = acerto.envio_id
											? enviosRaw?.find(e => e.envio_id === acerto.envio_id)
											: null;
										const dataEnvio = envio
											? (envio as { data_envio: string }).data_envio
											: null;
										return (
											<tr key={acerto.acerto_id} className="border-b border-[#E6F1FB] last:border-0 hover:bg-[#F4F8FD]">
												<td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
													{fmtData(acerto.data_recebimento ?? acerto.created_at)}
												</td>
												<td className="px-4 py-2.5 text-xs text-gray-500">
													{acerto.modelo_acerto === "COMISSAO" ? "Comissão" : "Valor mínimo"}
												</td>
												<td className="px-4 py-2.5 text-right font-medium text-gray-900">
													{fmtBRL(valor)}
												</td>
												<td className="px-4 py-2.5 text-right text-gray-700">
													{fmtBRL(acerto.valor_repassado)}
												</td>
												<td className="px-4 py-2.5 text-center">
													<Badge variant={acerto.status === "RECEBIDO" ? "success" : "warning"}>
														{acerto.status === "RECEBIDO" ? "Recebido" : "Pendente"}
													</Badge>
												</td>
												<td className="px-4 py-2.5 text-gray-500 text-xs">
													{dataEnvio ? (
														<Link
															href={`/envios/${acerto.envio_id}`}
															className="text-[#378ADD] hover:underline"
														>
															{fmtData(dataEnvio)}
														</Link>
													) : "—"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</>
				)}
			</section>
		</div>
	);
}

function Empty({ msg }: { readonly msg: string }) {
	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-8 text-center text-gray-400 text-sm">
			{msg}
		</div>
	);
}

function KpiCard({
	label,
	value,
	alert,
	sub,
}: {
	readonly label: string;
	readonly value: string;
	readonly alert?: boolean;
	readonly sub?: string;
}) {
	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3">
			<p className="text-xs text-gray-500 mb-1">{label}</p>
			<p className={`text-lg font-semibold ${alert ? "text-amber-700" : "text-gray-900"}`}>
				{value}
			</p>
			{sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
		</div>
	);
}
