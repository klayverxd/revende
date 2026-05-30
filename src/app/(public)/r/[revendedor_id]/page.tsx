import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { fmtData } from "@/lib/utils/data";

interface Props {
	readonly params: Promise<{ revendedor_id: string }>;
}

function fmtBRL(v: number | null | undefined) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function RevendedorExtrato({ params }: Props) {
	const { revendedor_id } = await params;
	const supabase = createAdminClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("nome, modelo_acerto")
		.eq("revendedor_id", revendedor_id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	const [{ data: enviosRaw }, { data: acertosRaw }] = await Promise.all([
		supabase
			.from("envio")
			.select(
				`envio_id, data_envio, status,
				itens:envio_item(
					modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida,
					valor_total_venda, valor_a_receber,
					modelo:modelo_id(nome, codigo)
				)`
			)
			.eq("revendedor_id", revendedor_id)
			.is("deleted_at", null)
			.order("data_envio", { ascending: false }),
		supabase
			.from("acerto")
			.select(
				"acerto_id, envio_id, status, modelo_acerto, valor_a_receber, valor_liquido, valor_repassado, data_recebimento, created_at"
			)
			.eq("revendedor_id", revendedor_id)
			.order("created_at", { ascending: false }),
	]);

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

	const envios = (enviosRaw ?? []) as unknown as Envio[];
	const acertos = (acertosRaw ?? []) as Array<{
		acerto_id: string;
		envio_id: string | null;
		status: string;
		modelo_acerto: string;
		valor_a_receber: number | null;
		valor_liquido: number | null;
		valor_repassado: number | null;
		data_recebimento: string | null;
		created_at: string;
	}>;

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

	// ── Histórico de conferências ────────────────────────────────────────────
	const conferidos = envios
		.filter(e => ["CONFERIDO", "ENCERRADO"].includes(e.status))
		.slice(0, 10);

	const agora = new Date().toLocaleString("pt-BR");

	return (
		<div className="min-h-screen bg-[#F4F8FD]">
			{/* Header */}
			<div className="bg-[#0C447C] px-4 pt-6 pb-5">
				<p className="text-[11px] text-[#B5D4F4] font-semibold tracking-widest uppercase mb-1">
					Revendê
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

				{/* ── Histórico de conferências ── */}
				{conferidos.length > 0 && (
					<section className="flex flex-col gap-3">
						<h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
							Histórico recente
						</h2>

						<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
							{conferidos.map((envio, i) => {
								const totalVendido = envio.itens.reduce((s, it) => s + (it.qtd_vendida ?? 0), 0);
								const totalEnviado = envio.itens.reduce((s, it) => s + (it.qtd_enviada ?? 0), 0);
								const valor = envio.itens.reduce((s, it) => s + (it.valor_total_venda ?? it.valor_a_receber ?? 0), 0);
								return (
									<div
										key={envio.envio_id}
										className={`px-4 py-3 flex items-center justify-between gap-3${i > 0 ? " border-t border-[#E6F1FB]" : ""}`}
									>
										<div>
											<p className="text-sm font-medium text-gray-900">{fmtData(envio.data_envio)}</p>
											<p className="text-xs text-gray-400">
												{totalVendido}/{totalEnviado} vendidos
											</p>
										</div>
										<div className="text-right">
											<p className="text-sm font-semibold text-gray-900">{fmtBRL(valor || null)}</p>
											<p className="text-[11px] text-gray-400">
												{envio.status === "ENCERRADO" ? "Encerrado" : "Conferido"}
											</p>
										</div>
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
