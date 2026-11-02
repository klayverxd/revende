import Link from "next/link";
import { buscarPedidos, buscarDashboardPedidos } from "@/app/(app)/pedidos/actions";
import PedidosList from "@/app/(app)/pedidos/PedidosList";
import PedidosDashboard from "@/app/(app)/pedidos/PedidosDashboard";
import { Button } from "@/components/ui";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "Produção · lista" };

/**
 * Visão de tabela da esteira, para quando é preciso filtrar, ordenar ou ver
 * muitos pedidos de uma vez — o kanban é bom para trabalhar, a tabela é boa
 * para conferir.
 */
export default async function ProducaoListaPage() {
	const [pedidos, dashboard] = await Promise.all([
		buscarPedidos(),
		buscarDashboardPedidos(),
	]);

	return (
		<div className="flex flex-col gap-6">
			<PageHeader title="Produção" />

			<div className="flex items-start justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						Pedidos em lista
					</h1>
					<p className="text-sm text-gray-500 mt-0.5">
						Todos os pedidos, com filtro e ordenação.
					</p>
				</div>
				<Link href="/producao">
					<Button variant="secondary" size="sm">
						Ver esteira
					</Button>
				</Link>
			</div>

			<PedidosDashboard dashboard={dashboard} />
			<PedidosList pedidos={pedidos} />
		</div>
	);
}
