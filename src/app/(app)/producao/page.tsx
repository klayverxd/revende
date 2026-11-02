import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buscarCardsEsteira } from "@/lib/queries/esteira";
import { hojeISO } from "@/lib/format";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";
import Esteira from "./Esteira";

export const metadata = { title: "Produção · Imprimimos" };

/**
 * A esteira de produção — o kanban que substitui o Trello.
 *
 * As colunas espelham as que já se usavam lá (ideias, orçamento, a fazer,
 * processo manual, mídia, a entregar, concluídos, cancelados), mas cada card
 * carrega o que o Trello não carregava: valor, custo e lucro.
 */
export default async function ProducaoPage() {
	const supabase = await createClient();

	const [cards, { data: membros }] = await Promise.all([
		buscarCardsEsteira(),
		// Para mostrar a inicial do responsável no card. `membro_equipe` guarda o
		// e-mail do convite, que é o que existe sem uma tabela de perfil.
		supabase.from("membro_equipe").select("membro_id, email_convidado"),
	]);

	const nomesPorUsuario: Record<string, string> = {};
	for (const m of membros ?? []) {
		const id = m.membro_id as string | null;
		if (!id) continue;
		const email = (m.email_convidado as string | null) ?? "";
		nomesPorUsuario[id] = email.split("@")[0] || email;
	}

	const hoje = hojeISO();
	const ativos = cards.filter(
		c => c.status !== "ENTREGUE" && c.status !== "CANCELADO"
	).length;

	return (
		<div className="flex flex-col gap-4">
			<PageHeader title="Produção" />

			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						Esteira de produção
					</h1>
					<p className="text-sm text-gray-600 mt-0.5">
						{ativos === 0
							? "Nada em andamento. Anote uma ideia para começar."
							: `${ativos} ${ativos === 1 ? "pedido" : "pedidos"} em andamento — arraste os cards entre as colunas.`}
					</p>
				</div>
				<Link href="/producao/lista">
					<Button variant="secondary" size="sm">
						Ver como tabela
					</Button>
				</Link>
			</div>

			<Esteira cards={cards} hoje={hoje} nomesPorUsuario={nomesPorUsuario} />
		</div>
	);
}
