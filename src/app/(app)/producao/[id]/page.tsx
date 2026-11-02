import { notFound } from "next/navigation";
import { buscarCardCompleto, buscarMembros } from "@/lib/queries/card";
import { buscarEtiquetas } from "@/lib/queries/esteira";
import { PageHeader } from "@/components/layout/PageHeader";
import CardDetalhe from "./CardDetalhe";

interface Props {
	readonly params: Promise<{ id: string }>;
}

export default async function CardPage({ params }: Props) {
	const { id } = await params;

	const [card, etiquetas, membros] = await Promise.all([
		buscarCardCompleto(id),
		buscarEtiquetas(),
		buscarMembros(),
	]);

	if (!card) notFound();

	return (
		<>
			<PageHeader title={card.titulo?.trim() || card.numero_pedido} />
			<CardDetalhe
				card={card}
				etiquetasDisponiveis={etiquetas}
				membros={membros}
			/>
		</>
	);
}
