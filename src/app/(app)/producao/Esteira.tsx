"use client";

import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/ui";
import { fmtBRL } from "@/lib/format";
import {
	COLUNAS_ESTEIRA,
	colunaDoStatus,
	ordemEntre,
	statusAoMover,
	type ColunaEsteira,
	type PedidoStatus,
} from "@/modules/pedido/status";
import { somarFinanceiro } from "@/modules/pedido/financeiro";
import type { CardEsteira as Card } from "@/lib/queries/esteira";
import { moverCard } from "./actions";
import CardEsteira from "./CardEsteira";
import CapturaRapida from "./CapturaRapida";

/**
 * O kanban da esteira de produção.
 *
 * Drag-and-drop com a API nativa do HTML5 — nenhuma dependência nova. O
 * arrasto é otimista: o card se move na tela na hora e a action grava depois,
 * porque esperar o round-trip para cada arrasto tornaria o quadro pesado de
 * usar.
 */

interface Props {
	readonly cards: Card[];
	readonly hoje: string;
	readonly nomesPorUsuario: Record<string, string>;
}

/** Movimento otimista aplicado sobre a lista vinda do servidor. */
type Movimento = {
	pedidoId: string;
	status: PedidoStatus;
	ordem: number;
};

export default function Esteira({ cards, hoje, nomesPorUsuario }: Props) {
	const { showToast } = useToast();
	const [, startTransition] = useTransition();

	const [cardsOtimistas, aplicarMovimento] = useOptimistic(
		cards,
		(atuais: Card[], mov: Movimento) =>
			atuais.map(c =>
				c.pedido_id === mov.pedidoId
					? { ...c, status: mov.status, ordem_esteira: mov.ordem }
					: c
			)
	);

	const [arrastando, setArrastando] = useState<string | null>(null);
	const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);
	const [recolhidas, setRecolhidas] = useState<Set<string>>(
		() => new Set(COLUNAS_ESTEIRA.filter(c => c.recolhidaPorPadrao).map(c => c.id))
	);
	const arrastandoRef = useRef<string | null>(null);

	const porColuna = useMemo(() => {
		const mapa = new Map<string, Card[]>(
			COLUNAS_ESTEIRA.map(c => [c.id, [] as Card[]])
		);
		for (const card of cardsOtimistas) {
			mapa.get(colunaDoStatus(card.status).id)?.push(card);
		}
		for (const lista of mapa.values()) {
			lista.sort(
				(a, b) => (a.ordem_esteira ?? 0) - (b.ordem_esteira ?? 0)
			);
		}
		return mapa;
	}, [cardsOtimistas]);

	function alternarRecolhida(id: string) {
		setRecolhidas(prev => {
			const proximo = new Set(prev);
			if (proximo.has(id)) proximo.delete(id);
			else proximo.add(id);
			return proximo;
		});
	}

	/**
	 * Solta o card na coluna, na posição do índice indicado.
	 * `indice` é a posição de inserção: 0 = topo, lista.length = fim.
	 */
	function soltar(coluna: ColunaEsteira, indice: number) {
		const pedidoId = arrastandoRef.current;
		arrastandoRef.current = null;
		setArrastando(null);
		setColunaAlvo(null);
		if (!pedidoId) return;

		const card = cardsOtimistas.find(c => c.pedido_id === pedidoId);
		if (!card) return;

		const destino = (porColuna.get(coluna.id) ?? []).filter(
			c => c.pedido_id !== pedidoId
		);
		const anterior = destino[indice - 1]?.ordem_esteira ?? null;
		const posterior = destino[indice]?.ordem_esteira ?? null;
		const ordem = ordemEntre(anterior, posterior);

		const novoStatus = statusAoMover(card.status, coluna.id);
		if (!novoStatus) return;

		// Nada mudou: mesma coluna e mesma vizinhança.
		if (novoStatus === card.status && card.ordem_esteira === ordem) return;

		startTransition(async () => {
			aplicarMovimento({ pedidoId, status: novoStatus, ordem });
			try {
				await moverCard(pedidoId, coluna.id, ordem);
			} catch (e) {
				showToast(
					e instanceof Error ? e.message : "Não foi possível mover o card",
					"error"
				);
			}
		});
	}

	return (
		<div className="flex gap-3 overflow-x-auto rolagem-fina pb-4 -mx-4 px-4 md:mx-0 md:px-0">
			{COLUNAS_ESTEIRA.map(coluna => {
				const lista = porColuna.get(coluna.id) ?? [];
				const recolhida = recolhidas.has(coluna.id);
				const total = somarFinanceiro(lista.map(c => c.financeiro));
				const alvo = colunaAlvo === coluna.id;

				if (recolhida) {
					return (
						<button
							key={coluna.id}
							type="button"
							onClick={() => alternarRecolhida(coluna.id)}
							onDragOver={e => {
								e.preventDefault();
								setColunaAlvo(coluna.id);
							}}
							onDrop={() => soltar(coluna, 0)}
							title={`Expandir ${coluna.titulo}`}
							className={`shrink-0 w-11 rounded-xl border bg-marca-50 hover:bg-marca-100 transition-colors flex flex-col items-center gap-2 py-3 ${
								alvo ? "border-marca-400 bg-marca-100" : "border-marca-200"
							}`}
						>
							<span className="text-xs font-semibold text-marca-600 tabular-nums">
								{lista.length}
							</span>
							<span
								className="text-[11px] font-medium text-marca-600 whitespace-nowrap"
								style={{ writingMode: "vertical-rl" }}
							>
								{coluna.titulo}
							</span>
						</button>
					);
				}

				return (
					<section
						key={coluna.id}
						className={`shrink-0 w-[16.5rem] flex flex-col rounded-xl border transition-colors ${
							alvo
								? "border-marca-400 bg-marca-100"
								: "border-marca-200 bg-marca-50"
						}`}
						onDragOver={e => {
							e.preventDefault();
							setColunaAlvo(coluna.id);
						}}
						onDragLeave={e => {
							// Só limpa quando o ponteiro sai da coluna de fato, não ao
							// passar sobre um card filho.
							if (!e.currentTarget.contains(e.relatedTarget as Node)) {
								setColunaAlvo(null);
							}
						}}
						onDrop={() => soltar(coluna, lista.length)}
					>
						<header className="flex items-center justify-between gap-1 px-2.5 pt-2.5 pb-1.5">
							<div className="flex items-center gap-1.5 min-w-0">
								<h2 className="text-xs font-semibold uppercase tracking-wide text-marca-700 truncate">
									{coluna.titulo}
								</h2>
								<span className="text-[11px] text-marca-500 tabular-nums shrink-0">
									{lista.length}
								</span>
							</div>
							<button
								type="button"
								onClick={() => alternarRecolhida(coluna.id)}
								title="Recolher coluna"
								className="text-marca-400 hover:text-marca-700 text-sm leading-none px-1"
							>
								−
							</button>
						</header>

						{total.receita > 0 && (
							<p className="px-2.5 pb-1.5 text-[11px] text-marca-600 tabular-nums">
								{fmtBRL(total.receita)}
								{total.temCustos && (
									<span
										className={
											total.lucro >= 0 ? " text-sucesso" : " text-perigo"
										}
									>
										{" · "}
										{fmtBRL(total.lucro)}
									</span>
								)}
							</p>
						)}

						<div className="flex-1 flex flex-col gap-2 px-2 pb-2 min-h-[4rem] max-h-[calc(100vh-19rem)] overflow-y-auto rolagem-fina">
							{lista.length === 0 && (
								<p className="text-xs text-marca-400 text-center py-6">
									{alvo ? "Solte aqui" : "Vazio"}
								</p>
							)}

							{lista.map((card, i) => (
								<div
									key={card.pedido_id}
									onDragOver={e => {
										e.preventDefault();
										e.stopPropagation();
										setColunaAlvo(coluna.id);
									}}
									onDrop={e => {
										e.stopPropagation();
										// Solta acima ou abaixo, conforme a metade do card.
										const caixa = e.currentTarget.getBoundingClientRect();
										const acima = e.clientY < caixa.top + caixa.height / 2;
										soltar(coluna, acima ? i : i + 1);
									}}
								>
									<CardEsteira
										card={card}
										hoje={hoje}
										responsavelNome={
											card.responsavel_id
												? nomesPorUsuario[card.responsavel_id]
												: null
										}
										arrastando={arrastando === card.pedido_id}
										onDragStart={() => {
											arrastandoRef.current = card.pedido_id;
											setArrastando(card.pedido_id);
										}}
										onDragEnd={() => {
											arrastandoRef.current = null;
											setArrastando(null);
											setColunaAlvo(null);
										}}
									/>
								</div>
							))}

							<CapturaRapida coluna={coluna} />
						</div>
					</section>
				);
			})}
		</div>
	);
}
