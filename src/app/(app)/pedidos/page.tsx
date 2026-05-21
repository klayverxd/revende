import { buscarPedidos, buscarDashboardPedidos } from "./actions";
import PedidosList from "./PedidosList";
import PedidosDashboard from "./PedidosDashboard";

export default async function PedidosPage() {
	const [pedidos, dashboard] = await Promise.all([
		buscarPedidos(),
		buscarDashboardPedidos(),
	]);

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">Pedidos</h1>
				<p className="text-sm text-gray-500 mt-0.5">
					Gerencie a esteira de produção dos pedidos.
				</p>
			</div>

			<PedidosDashboard dashboard={dashboard} />
			<PedidosList pedidos={pedidos} />
		</div>
	);
}
