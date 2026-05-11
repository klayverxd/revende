import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

interface Props {
	readonly params: Promise<{ revendedor_id: string }>;
}

export default async function RevendedorExtrato({ params }: Props) {
	const { revendedor_id } = await params;
	const supabase = createAdminClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("nome")
		.eq("revendedor_id", revendedor_id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	const { data: enviosRaw } = await supabase
		.from("envio")
		.select("envio_id")
		.eq("revendedor_id", revendedor_id)
		.eq("status", "ABERTO")
		.is("deleted_at", null);

	const envioIds = (enviosRaw ?? []).map(e => e.envio_id as string);

	const produtosMap = new Map<
		string,
		{
			nome: string;
			codigo: string | null;
			enviado: number;
			vendido: number;
			devolvido: number;
		}
	>();

	if (envioIds.length > 0) {
		const { data: itensRaw } = await supabase
			.from("envio_item")
			.select(
				"modelo_id, qtd_enviada, qtd_vendida, qtd_devolvida, modelo:modelo_id(nome, codigo)"
			)
			.in("envio_id", envioIds)
			.is("deleted_at", null);

		for (const item of itensRaw ?? []) {
			const modeloId = item.modelo_id as string;
			const modelo = item.modelo as unknown as {
				nome: string;
				codigo: string | null;
			} | null;
			const enviado = (item.qtd_enviada as number) ?? 0;
			const vendido = (item.qtd_vendida as number | null) ?? 0;
			const devolvido = (item.qtd_devolvida as number | null) ?? 0;

			const existing = produtosMap.get(modeloId);
			if (existing) {
				existing.enviado += enviado;
				existing.vendido += vendido;
				existing.devolvido += devolvido;
			} else {
				produtosMap.set(modeloId, {
					nome: modelo?.nome ?? "Produto",
					codigo: modelo?.codigo ?? null,
					enviado,
					vendido,
					devolvido,
				});
			}
		}
	}

	const produtos = Array.from(produtosMap.values())
		.map(p => ({ ...p, emMaos: p.enviado - p.vendido - p.devolvido }))
		.filter(p => p.emMaos > 0)
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

	const totalUnidades = produtos.reduce((acc, p) => acc + p.emMaos, 0);
	const agora = new Date().toLocaleString("pt-BR");

	return (
		<div className="min-h-screen bg-[#F4F8FD]">
			{/* Header */}
			<div className="bg-[#0C447C] px-4 pt-6 pb-5">
				<p className="text-[11px] text-[#B5D4F4] font-semibold tracking-widest uppercase mb-1">
					Revendê
				</p>
				<h1 className="text-xl font-bold text-white leading-tight">
					Produtos em consignação
				</h1>
				<p className="text-sm text-[#B5D4F4] mt-1">
					{revendedor.nome as string}
				</p>
			</div>

			<div className="px-4 py-4 max-w-lg mx-auto">
				<p className="text-xs text-gray-400 mb-4">Consultado em {agora}</p>

				{produtos.length === 0 ? (
					<div className="bg-white rounded-xl border border-[#B5D4F4] p-8 text-center">
						<p className="text-gray-500 text-sm">
							Você não tem produtos em consignação no momento.
						</p>
					</div>
				) : (
					<>
						{/* Summary cards */}
						<div className="grid grid-cols-2 gap-3 mb-4">
							<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 text-center">
								<p className="text-3xl font-bold text-[#0C447C]">
									{produtos.length}
								</p>
								<p className="text-xs text-gray-500 mt-0.5">
									produto{produtos.length !== 1 ? "s" : ""}
								</p>
							</div>
							<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3 text-center">
								<p className="text-3xl font-bold text-[#0C447C]">
									{totalUnidades}
								</p>
								<p className="text-xs text-gray-500 mt-0.5">
									unidade{totalUnidades !== 1 ? "s" : ""} em mãos
								</p>
							</div>
						</div>

						{/* Products list */}
						<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-hidden">
							{produtos.map((p, i) => (
								<div
									key={p.nome + p.codigo}
									className={`px-4 py-3.5 flex items-center justify-between gap-3${
										i > 0 ? " border-t border-[#E6F1FB]" : ""
									}`}
								>
									<div className="min-w-0">
										<p className="text-sm font-semibold text-gray-900 truncate">
											{p.nome}
										</p>
										{p.codigo && (
											<p className="text-xs text-gray-400">{p.codigo}</p>
										)}
										<p className="text-xs text-gray-500 mt-0.5">
											{p.enviado} enviado
											{p.vendido > 0 ? ` · ${p.vendido} vendido` : ""}
											{p.devolvido > 0 ? ` · ${p.devolvido} devolvido` : ""}
										</p>
									</div>
									<div className="text-right shrink-0">
										<p className="text-2xl font-bold text-[#185FA5] leading-none">
											{p.emMaos}
										</p>
										<p className="text-[11px] text-gray-400 mt-0.5">em mãos</p>
									</div>
								</div>
							))}
						</div>

						<p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
							Apenas envios ativos são exibidos.
							<br />
							Envios já conferidos não aparecem aqui.
						</p>
					</>
				)}
			</div>
		</div>
	);
}
