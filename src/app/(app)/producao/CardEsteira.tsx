"use client";

import Link from "next/link";
import { fmtBRL, fmtData } from "@/lib/format";
import {
	situacaoPrazo,
	STATUS_LABEL,
	type SituacaoPrazo,
} from "@/modules/pedido/status";
import type { CardEsteira as Card } from "@/lib/queries/esteira";

/**
 * A frente do card, na ordem de leitura:
 *   capa → etiquetas → título → badges → rodapé com dinheiro
 *
 * O que o Trello tem, mais o que só faz sentido aqui: valor e lucro. É
 * justamente o que se perdia quando o card vivia no Trello e o dinheiro não
 * ficava em lugar nenhum.
 */

const PRAZO_ESTILO: Record<SituacaoPrazo, string> = {
	ATRASADO: "bg-perigo-fundo text-perigo border-red-200 font-semibold",
	HOJE: "bg-atencao-fundo text-atencao border-amber-200 font-semibold",
	FUTURO: "bg-marca-50 text-marca-600 border-marca-200",
	CUMPRIDO: "bg-sucesso-fundo text-sucesso border-green-200 line-through",
	SEM_PRAZO: "",
};

const PRIORIDADE_PONTO: Record<string, string> = {
	NORMAL: "",
	ALTA: "bg-amber-400",
	URGENTE: "bg-red-500",
};

const CANAL_LABEL: Record<string, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

function Badge({
	children,
	className = "",
	title,
}: {
	children: React.ReactNode;
	className?: string;
	title?: string;
}) {
	return (
		<span
			title={title}
			className={`inline-flex items-center gap-1 text-[11px] leading-none px-1.5 py-1 rounded border ${className}`}
		>
			{children}
		</span>
	);
}

interface Props {
	readonly card: Card;
	readonly hoje: string;
	/** Nome do responsável, quando houver — resolvido pela página. */
	readonly responsavelNome?: string | null;
	readonly arrastando?: boolean;
	readonly onDragStart: (e: React.DragEvent) => void;
	readonly onDragEnd: () => void;
}

export default function CardEsteira({
	card,
	hoje,
	responsavelNome,
	arrastando,
	onDragStart,
	onDragEnd,
}: Props) {
	const prazo = situacaoPrazo(card.data_prazo, hoje, {
		prazoConcluido: card.prazo_concluido,
		status: card.status,
	});

	const titulo =
		card.titulo?.trim() ||
		card.cliente_nome?.trim() ||
		card.produtos[0] ||
		card.numero_pedido;

	const temChecklist = card.checklist_total > 0;
	const checklistCompleto =
		temChecklist && card.checklist_concluidos === card.checklist_total;

	const { financeiro } = card;

	return (
		<article
			draggable
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			className={`group bg-white rounded-lg border border-marca-200 shadow-sm hover:shadow-md hover:border-marca-300 transition-all cursor-grab active:cursor-grabbing ${
				arrastando ? "card-arrastando" : ""
			}`}
		>
			<Link href={`/producao/${card.pedido_id}`} className="block p-2.5">
				{card.capa_url && (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={card.capa_url}
						alt=""
						className="w-full h-24 object-cover rounded mb-2"
					/>
				)}

				{card.etiquetas.length > 0 && (
					<div className="flex flex-wrap gap-1 mb-1.5">
						{card.etiquetas.map(e => (
							<span
								key={e.etiqueta_id}
								title={e.nome}
								style={{ backgroundColor: e.cor }}
								className="h-2 w-8 rounded-full"
							/>
						))}
					</div>
				)}

				<div className="flex items-start gap-1.5">
					{card.prioridade !== "NORMAL" && (
						<span
							title={card.prioridade === "URGENTE" ? "Urgente" : "Alta"}
							className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORIDADE_PONTO[card.prioridade]}`}
						/>
					)}
					<h3 className="text-sm font-medium text-gray-900 leading-snug line-clamp-3">
						{titulo}
					</h3>
				</div>

				{card.cliente_nome && titulo !== card.cliente_nome && (
					<p className="text-xs text-gray-500 mt-0.5 truncate">
						{card.cliente_nome}
					</p>
				)}

				<div className="flex flex-wrap items-center gap-1 mt-2">
					{prazo !== "SEM_PRAZO" && (
						<Badge
							className={PRAZO_ESTILO[prazo]}
							title={
								prazo === "ATRASADO"
									? "Prazo vencido"
									: prazo === "HOJE"
										? "Entrega hoje"
										: prazo === "CUMPRIDO"
											? "Prazo cumprido"
											: "No prazo"
							}
						>
							{prazo === "ATRASADO" && "⚠ "}
							{fmtData(card.data_prazo)}
						</Badge>
					)}

					{temChecklist && (
						<Badge
							className={
								checklistCompleto
									? "bg-sucesso-fundo text-sucesso border-green-200"
									: "bg-gray-50 text-gray-600 border-gray-200"
							}
							title="Itens de checklist concluídos"
						>
							☑ {card.checklist_concluidos}/{card.checklist_total}
						</Badge>
					)}

					{card.tem_descricao && (
						<Badge
							className="bg-gray-50 text-gray-500 border-gray-200"
							title="Tem descrição"
						>
							≡
						</Badge>
					)}

					{card.comentarios > 0 && (
						<Badge
							className="bg-gray-50 text-gray-600 border-gray-200"
							title="Comentários"
						>
							💬 {card.comentarios}
						</Badge>
					)}

					{card.anexos > 0 && (
						<Badge
							className="bg-gray-50 text-gray-600 border-gray-200"
							title="Anexos"
						>
							📎 {card.anexos}
						</Badge>
					)}
				</div>

				<div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-marca-100">
					<div className="min-w-0">
						{financeiro.receita > 0 ? (
							<p className="text-sm font-semibold text-gray-900 leading-none">
								{fmtBRL(financeiro.receita)}
							</p>
						) : (
							<p className="text-xs text-gray-400 leading-none">Sem valor</p>
						)}
						{financeiro.temCustos && (
							<p
								className={`text-[11px] mt-1 leading-none ${
									financeiro.lucro >= 0 ? "text-sucesso" : "text-perigo"
								}`}
								title={`Custo ${fmtBRL(financeiro.custoTotal)} · margem ${financeiro.margemPct}%`}
							>
								lucro {fmtBRL(financeiro.lucro)}
							</p>
						)}
					</div>

					<div className="flex items-center gap-1.5 shrink-0">
						<span
							className="text-[11px] text-gray-400"
							title={`Canal: ${CANAL_LABEL[card.canal] ?? card.canal}`}
						>
							{(CANAL_LABEL[card.canal] ?? card.canal).slice(0, 4)}
						</span>
						{responsavelNome && (
							<span
								title={`Responsável: ${responsavelNome}`}
								className="h-5 w-5 rounded-full bg-marca-500 text-white text-[10px] font-semibold flex items-center justify-center"
							>
								{responsavelNome.trim().charAt(0).toUpperCase()}
							</span>
						)}
					</div>
				</div>

				<p className="text-[10px] text-gray-300 mt-1.5 leading-none">
					{card.numero_pedido}
					{/* O status importa quando a coluna agrupa vários. */}
					{card.status !== "NOVO" && ` · ${STATUS_LABEL[card.status]}`}
				</p>
			</Link>
		</article>
	);
}
