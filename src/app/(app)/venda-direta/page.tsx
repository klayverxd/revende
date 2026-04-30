import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui";
import VendaDiretaTable, { type VendaDiretaRow } from "./VendaDiretaTable";

export default async function VendaDiretaPage() {
	const supabase = await createClient();

	const { data: vendasRaw } = await supabase
		.from("venda_direta")
		.select(
			"venda_id, data_venda, canal, forma_pagamento, valor_total, venda_direta_item(item_id)"
		)
		.is("deleted_at", null)
		.order("data_venda", { ascending: false });

	const vendas: VendaDiretaRow[] = (vendasRaw ?? []).map(v => {
		const itens = v.venda_direta_item as Array<{ item_id: string }> | null;
		return {
			venda_id: v.venda_id as string,
			data_venda: v.data_venda as string,
			canal: v.canal as
				| "PRESENCIAL"
				| "WHATSAPP"
				| "FEIRA"
				| "EVENTO"
				| "INSTAGRAM"
				| "OUTRO",
			forma_pagamento: v.forma_pagamento as
				| "PIX"
				| "DINHEIRO"
				| "CARTAO"
				| "OUTRO",
			valor_total: (v.valor_total as number) ?? 0,
			total_itens: itens?.length ?? 0,
		};
	});

	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Venda direta</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						Registre vendas sem revendedor com controle de canal e pagamento.
					</p>
				</div>
				<Link href="/venda-direta/nova">
					<Button size="sm">+ Nova venda</Button>
				</Link>
			</div>

			<VendaDiretaTable vendas={vendas} />
		</div>
	);
}
