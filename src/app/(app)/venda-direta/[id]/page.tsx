import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";

interface Props {
	params: Promise<{ id: string }>;
}

const PRECO_ORIGEM_LABEL: Record<string, string> = {
	MODELO: "Preço do modelo",
	REVENDEDOR: "Preço do revendedor",
	MANUAL: "Manual",
};

const CANAL_LABEL: Record<string, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	FEIRA: "Feira",
	EVENTO: "Evento",
	INSTAGRAM: "Instagram",
	OUTRO: "Outro",
};

const PAGAMENTO_LABEL: Record<string, string> = {
	PIX: "PIX",
	DINHEIRO: "Dinheiro",
	CARTAO: "Cartão",
	OUTRO: "Outro",
};

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function VendaDiretaDetalhePage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: venda, error: vendaError } = await supabase
		.from("venda_direta")
		.select(
			"venda_id, data_venda, canal, forma_pagamento, desconto, valor_total, observacao, cliente_nome, cliente_contato"
		)
		.eq("venda_id", id)
		.is("deleted_at", null)
		.single();

	if (vendaError || !venda) notFound();

	const { data: itensRaw, error: itensError } = await supabase
		.from("venda_direta_item")
		.select(
			"item_id, quantidade, preco_unitario, preco_origem, subtotal, modelo:modelo_id(nome, codigo)"
		)
		.eq("venda_id", id)
		.is("deleted_at", null);

	if (itensError) throw new Error(itensError.message);

	const itens = (itensRaw ?? []).map(i => {
		const modelo = i.modelo as unknown as {
			nome: string;
			codigo: string | null;
		} | null;
		return {
			item_id: i.item_id as string,
			nome: modelo?.nome ?? "Produto",
			codigo: modelo?.codigo ?? null,
			quantidade: (i.quantidade as number | null) ?? 0,
			preco_unitario: (i.preco_unitario as number | null) ?? 0,
			preco_origem: (i.preco_origem as string | null) ?? "MODELO",
			subtotal: (i.subtotal as number | null) ?? 0,
		};
	});

	const desconto = (venda.desconto as number | null) ?? 0;
	const valorTotal = (venda.valor_total as number | null) ?? 0;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						Detalhes da venda
					</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Venda #{(venda.venda_id as string).slice(0, 8)} em{" "}
						{fmtDate(venda.data_venda as string)}
					</p>
				</div>
				<Link href="/venda-direta">
					<Button variant="secondary" size="sm">
						Voltar
					</Button>
				</Link>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-500">Canal</p>
					<p className="text-sm font-medium text-gray-900 mt-1">
						{CANAL_LABEL[venda.canal as string] ?? (venda.canal as string)}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-500">Pagamento</p>
					<p className="text-sm font-medium text-gray-900 mt-1">
						{PAGAMENTO_LABEL[venda.forma_pagamento as string] ??
							(venda.forma_pagamento as string)}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-500">Cliente</p>
					<p className="text-sm font-medium text-gray-900 mt-1">
						{(venda.cliente_nome as string | null) ?? "Nao informado"}
					</p>
					<p className="text-xs text-gray-600 mt-1">
						{(venda.cliente_contato as string | null) ?? ""}
					</p>
				</div>
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4">
					<p className="text-xs text-gray-500">Observacao</p>
					<p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">
						{(venda.observacao as string | null) ?? "Sem observacoes"}
					</p>
				</div>
			</div>

			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Produto
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Qtd
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Preco un.
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Origem
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								Subtotal
							</th>
						</tr>
					</thead>
					<tbody>
						{itens.map(item => (
							<tr
								key={item.item_id}
								className="border-b border-[#B5D4F4] last:border-0"
							>
								<td className="px-3 py-2.5">
									<p className="font-medium text-gray-900">{item.nome}</p>
									<p className="text-xs text-gray-500 font-mono">
										{item.codigo ?? "-"}
									</p>
								</td>
								<td className="px-3 py-2.5 text-right text-gray-700">
									{item.quantidade}
								</td>
								<td className="px-3 py-2.5 text-right text-gray-700">
									{fmtCurrency(item.preco_unitario)}
								</td>
								<td className="px-3 py-2.5 text-gray-700">
									{PRECO_ORIGEM_LABEL[item.preco_origem] ?? item.preco_origem}
								</td>
								<td className="px-3 py-2.5 text-right font-medium text-gray-900">
									{fmtCurrency(item.subtotal)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="ml-auto w-full md:w-[360px] rounded-xl border border-[#B5D4F4] bg-white p-4 space-y-2">
				<div className="flex items-center justify-between text-sm">
					<span className="text-gray-600">Desconto</span>
					<span className="font-medium text-gray-900">
						{fmtCurrency(desconto)}
					</span>
				</div>
				<div className="flex items-center justify-between border-t border-[#B5D4F4] pt-2 text-sm">
					<span className="text-gray-700 font-medium">Total</span>
					<span className="font-semibold text-gray-900">
						{fmtCurrency(valorTotal)}
					</span>
				</div>
			</div>
		</div>
	);
}
