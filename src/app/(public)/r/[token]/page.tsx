import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtBRL, fmtData } from "@/lib/format";
import { validarToken } from "@/lib/tokens";

interface Props {
	readonly params: Promise<{ token: string }>;
}

/**
 * Extrato público do revendedor, endereçado por token.
 *
 * Esta página roda para visitante anônimo, então usa o client de service
 * role — que ignora o RLS. Por isso o endereçamento é por `extrato_token` e
 * não por `revendedor_id`: a versão anterior aceitava o UUID da linha na
 * URL, o que deixava qualquer pessoa ler o extrato de qualquer revendedor de
 * qualquer workspace.
 *
 * Regras que sustentam a segurança daqui:
 *  - o token é validado como UUID ANTES de tocar o banco;
 *  - a busca é por token + extrato_ativo, nunca por id vindo da URL;
 *  - falha sempre em notFound(), nunca em redirect — um redirect para /login
 *    já contaria como confirmação de que o token existe;
 *  - todas as consultas seguintes usam o revendedor_id RESOLVIDO do token.
 */
export default async function RevendedorExtrato({ params }: Props) {
	const { token } = await params;
	const tokenValido = validarToken(token);
	if (!tokenValido) notFound();

	const supabase = createAdminClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, nome, modelo_acerto")
		.eq("extrato_token", tokenValido)
		.eq("extrato_ativo", true)
		.is("deleted_at", null)
		.maybeSingle();

	if (!revendedor) notFound();

	const revendedor_id = revendedor.revendedor_id as string;

	// Step 1: envios e acertos em paralelo (ambos com deleted_at IS NULL)
	const [{ data: enviosBaseRaw }, { data: acertosRaw }] = await Promise.all([
		supabase
			.from("envio")
			.select("envio_id, data_envio, status")
			.eq("revendedor_id", revendedor_id)
			.is("deleted_at", null)
			.order("data_envio", { ascending: false }),
		supabase
			.from("acerto")
			.select(
				"acerto_id, envio_id, status, modelo_acerto, valor_a_receber, valor_liquido, comissao_calculada, valor_repassado, data_recebimento, created_at"
			)
			.eq("revendedor_id", revendedor_id)
			.is("deleted_at", null)
			.order("created_at", { ascending: false }),
	]);

	// Step 2: itens separados para aplicar deleted_at IS NULL corretamente
	const envioIds = (enviosBaseRaw ?? []).map(e => e.envio_id as string);
	const { data: itensRaw } = envioIds.length > 0
		? await supabase
			.from("envio_item")
			.select(
				"envio_item_id, envio_id, modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida, valor_total_venda, valor_a_receber, modelo:modelo_id(nome, codigo)"
			)
			.in("envio_id", envioIds)
			.is("deleted_at", null)
		: { data: [] as unknown[] };

	type EnvioItem = {
		modelo_id: string;
		qtd_enviada: number;
		qtd_vendida: number | null;
		qtd_devolvida: number | null;
		valor_total_venda: number | null;
		valor_a_receber: number | null;
		modelo: { nome: string; codigo: string | null } | null;
	};

	type Envio = {
		envio_id: string;
		data_envio: string;
		status: string;
		itens: EnvioItem[];
	};

	// Monta itens por envio_id
	const itensByEnvio = new Map<string, EnvioItem[]>();
	for (const i of (itensRaw ?? []) as unknown as (EnvioItem & { envio_id: string })[]) {
		if (!itensByEnvio.has(i.envio_id)) itensByEnvio.set(i.envio_id, []);
		itensByEnvio.get(i.envio_id)!.push(i);
	}

	const envios: Envio[] = (enviosBaseRaw ?? []).map(e => ({
		envio_id: e.envio_id as string,
		data_envio: e.data_envio as string,
		status: e.status as string,
		itens: itensByEnvio.get(e.envio_id as string) ?? [],
	}));

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
		created_at: string;
	}>;

	const acertoByEnvio = new Map(acertos.map(a => [a.envio_id, a]));

	// ── Consignação atual (ABERTO ou CONFERIDO com itens restantes) ─────────
	const comRestante = envios.filter(e => ["ABERTO", "CONFERIDO"].includes(e.status));

	const produtosMap = new Map<string, { nome: string; codigo: string | null; emMaos: number }>();
	for (const envio of comRestante) {
		for (const item of envio.itens) {
			const key = item.modelo_id;
			const existing = produtosMap.get(key) ?? {
				nome: item.modelo?.nome ?? "Produto",
				codigo: item.modelo?.codigo ?? null,
				emMaos: 0,
			};
			existing.emMaos += (item.qtd_enviada ?? 0) - (item.qtd_vendida ?? 0) - (item.qtd_devolvida ?? 0);
			produtosMap.set(key, existing);
		}
	}
	const produtos = [...produtosMap.values()]
		.filter(p => p.emMaos > 0)
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
	const totalUnidades = produtos.reduce((acc, p) => acc + p.emMaos, 0);

	// ── Acertos pendentes ────────────────────────────────────────────────────
	const acertosPendentes = acertos.filter(a => a.status === "PENDENTE");
	const totalPendente = acertosPendentes.reduce((s, a) => {
		const val = a.modelo_acerto === "COMISSAO" ? (a.valor_liquido ?? 0) : (a.valor_a_receber ?? 0);
		return s + val;
	}, 0);

	// ── Histórico completo de envios ─────────────────────────────────────────
	const historicoEnvios = envios.slice(0, 15);

	const agora = new Date().toLocaleString("pt-BR");

	return (
		<div className="min-h-screen bg-[#F4F8FD]">
			{/* Header */}
			<div className="bg-[#0C447C] px-4 pt-6 pb-5">
				<p className="text-[11px] text-[#B5D4F4] font-semibold tracking-widest uppercase mb-1">
					Imprimimos
				</p>
				<h1 className="text-xl font-bold text-white leading-tight">
					{revendedor.nome as string}
				</h1>
				<p className="text-sm text-[#B5D4F4] mt-0.5">Extrato do revendedor</p>
			</div>

			<div className="px-4 py-4 max-w-lg mx-auto flex flex-col gap-6">
				<p className="text-xs text-gray-400 -mb-3">Consultado em {agora}</p>

				{/* ── Em consignação ── */}
				<section className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
						Produtos em mãos
					</h2>

					{produtos.length === 0 ? (
						<div className="bg-white rounded-xl border border-[#B5D4F4] p-6 text-center">
							<p className="text-gray-500 text-sm">
								Nenhum produto em consignação no momento.
							</p>
						</div>
					) : (
						<>
							<div className="grid grid-cols-2 gap-3">
								<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 text-center">
									<p className="text-3xl font-bold text-[#0C447C]">{produtos.length}</p>
									<p className="text-xs text-gray-500 mt-0.5">
										produto{produtos.length !== 1 ? "s" : ""}
									</p>
								</div>
								<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 text-center">
									<p className="text-3xl font-bold text-[#0C447C]">{totalUnidades}</p>
									<p className="text-xs text-gray-500 mt-0.5">
										unidade{totalUnidades !== 1 ? "s" : ""} em mãos
									</p>
								</div>
							</div>

							<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
								{produtos.map((p, i) => (
									<div
										key={p.nome + p.codigo}
										className={`px-4 py-3.5 flex items-center justify-between gap-3${i > 0 ? " border-t border-[#E6F1FB]" : ""}`}
									>
										<div className="min-w-0">
											<p className="text-sm font-semibold text-gray-900 truncate uppercase">{p.nome}</p>
											{p.codigo && (
												<p className="text-xs text-gray-400 font-mono">{p.codigo}</p>
											)}
										</div>
										<div className="text-right shrink-0">
											<p className="text-2xl font-bold text-[#185FA5] leading-none">{p.emMaos}</p>
											<p className="text-[11px] text-gray-400 mt-0.5">em mãos</p>
										</div>
									</div>
								))}
							</div>
						</>
					)}
				</section>

				{/* ── Acertos pendentes ── */}
				<section className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
						Valores a repassar
					</h2>

					{acertosPendentes.length === 0 ? (
						<div className="bg-white rounded-xl border border-[#B5D4F4] p-6 text-center">
							<p className="text-green-700 font-medium text-sm">Tudo em dia! Nenhum valor pendente.</p>
						</div>
					) : (
						<>
							<div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
								<p className="text-sm text-amber-800 font-medium">Total pendente</p>
								<p className="text-lg font-bold text-amber-700">{fmtBRL(totalPendente)}</p>
							</div>

							<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
								{acertosPendentes.map((a, i) => {
									const valor = a.modelo_acerto === "COMISSAO" ? a.valor_liquido : a.valor_a_receber;
									const envio = envios.find(e => e.envio_id === a.envio_id);
									return (
										<div
											key={a.acerto_id}
											className={`px-4 py-3 flex items-center justify-between gap-3${i > 0 ? " border-t border-[#E6F1FB]" : ""}`}
										>
											<div>
												<p className="text-sm text-gray-700">
													Envio de {envio ? fmtData(envio.data_envio) : fmtData(a.created_at)}
												</p>
												<p className="text-xs text-gray-400">
													{a.modelo_acerto === "COMISSAO" ? "Comissão" : "Valor mínimo"}
												</p>
											</div>
											<p className="text-base font-semibold text-amber-700 shrink-0">{fmtBRL(valor)}</p>
										</div>
									);
								})}
							</div>
						</>
					)}
				</section>

				{/* ── Histórico de envios ── */}
				{historicoEnvios.length > 0 && (
					<section className="flex flex-col gap-3">
						<h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
							Histórico recente
						</h2>

						<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
							{historicoEnvios.map((envio: Envio, i: number) => {
								const totalEnviado = envio.itens.reduce((s: number, it: EnvioItem) => s + (it.qtd_enviada ?? 0), 0);
								const totalVendido = envio.itens.reduce((s: number, it: EnvioItem) => s + (it.qtd_vendida ?? 0), 0);
								const totalRestante = totalEnviado - totalVendido - envio.itens.reduce((s: number, it: EnvioItem) => s + (it.qtd_devolvida ?? 0), 0);
								const isAberto = envio.status === "ABERTO";
								const acerto = acertoByEnvio.get(envio.envio_id);
								const isComissao = acerto?.modelo_acerto === "COMISSAO";
								const totalVendas = envio.itens.reduce((s: number, it: EnvioItem) => s + (it.valor_total_venda ?? 0), 0);
								const comissao = acerto?.comissao_calculada ?? 0;
								const liquido = acerto?.valor_liquido ?? null;
								const valorMinimo = acerto?.valor_a_receber ?? null;

								const statusLabels: Record<string, string> = { ENCERRADO: "Encerrado", CONFERIDO: "Conferido", ABERTO: "Em aberto" };
								const statusLabel = statusLabels[envio.status] ?? "Em aberto";

								return (
									<div
										key={envio.envio_id}
										className={`px-4 py-3 flex flex-col gap-2${i > 0 ? " border-t border-[#E6F1FB]" : ""}`}
									>
										<div className="flex items-center justify-between gap-2">
											<p className="text-sm font-medium text-gray-900">{fmtData(envio.data_envio)}</p>
											<p className={`text-[11px] ${isAberto ? "text-amber-600 font-medium" : "text-gray-400"}`}>
												{isAberto
													? `${totalEnviado} enviados · aguardando conferência`
													: `${totalVendido}/${totalEnviado} vendidos · ${statusLabel}`}
											</p>
										</div>

										{/* Itens enviados (abertos) ou vendidos (conferidos) */}
										<div className="flex flex-wrap gap-1">
											{isAberto
												? envio.itens
													.filter((it: EnvioItem) => (it.qtd_enviada ?? 0) > 0)
													.map((it: EnvioItem) => (
														<span key={it.modelo_id} className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
															{it.modelo?.nome ?? "Produto"} × {it.qtd_enviada}
															{totalRestante > 0 && <span className="text-amber-500"> (restam {it.qtd_enviada - (it.qtd_vendida ?? 0) - (it.qtd_devolvida ?? 0)})</span>}
														</span>
													))
												: envio.itens
													.filter((it: EnvioItem) => (it.qtd_vendida ?? 0) > 0)
													.map((it: EnvioItem) => (
														<span key={it.modelo_id} className="text-[11px] bg-[#E6F1FB] text-[#185FA5] rounded px-2 py-0.5">
															{it.modelo?.nome ?? "Produto"} × {it.qtd_vendida}
														</span>
													))
											}
										</div>

										{/* Breakdown financeiro (apenas conferidos/encerrados) */}
										{!isAberto && (isComissao ? (
											<div className="flex flex-col gap-0.5 text-xs">
												<div className="flex justify-between text-gray-500">
													<span>Total de vendas</span>
													<span className="font-medium text-gray-800">{fmtBRL(totalVendas || null)}</span>
												</div>
												<div className="flex justify-between text-gray-500">
													<span>Comissão</span>
													<span className="text-amber-700">− {fmtBRL(comissao || null)}</span>
												</div>
												<div className="flex justify-between font-semibold text-gray-900 border-t border-[#E6F1FB] pt-0.5 mt-0.5">
													<span>Valor a repassar</span>
													<span className="text-[#0C447C]">{fmtBRL(liquido)}</span>
												</div>
											</div>
										) : (
											<div className="flex justify-between text-xs font-semibold text-gray-900">
												<span>Valor a repassar</span>
												<span className="text-[#0C447C]">{fmtBRL(valorMinimo)}</span>
											</div>
										))}
									</div>
								);
							})}
						</div>
					</section>
				)}

				<p className="text-[11px] text-gray-400 text-center leading-relaxed pb-4">
					Este extrato é atualizado em tempo real.
					<br />
					Entre em contato caso tenha dúvidas.
				</p>
			</div>
		</div>
	);
}
