import { notFound } from "next/navigation";
import { buscarPedido } from "../actions";
import PedidoDetalhe from "./PedidoDetalhe";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function PedidoPage({ params }: Props) {
	const { id } = await params;
	const pedido = await buscarPedido(id);

	if (!pedido) notFound();

	return <PedidoDetalhe pedido={pedido as Parameters<typeof PedidoDetalhe>[0]["pedido"]} />;
}
