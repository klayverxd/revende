"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import type { Checklist } from "@/lib/queries/card";
import {
	adicionarItemChecklist,
	criarChecklist,
	marcarItemChecklist,
	removerChecklist,
	removerItemChecklist,
} from "../cardActions";

/**
 * Checklists do card, no padrão Trello: várias por card, cada uma com sua
 * barra de progresso.
 *
 * Serve para o que a impressão 3D pede — "Impressão", "Acabamento", "Envio" —
 * em vez de uma lista só e genérica.
 */
export default function Checklists({
	pedidoId,
	checklists,
}: {
	readonly pedidoId: string;
	readonly checklists: Checklist[];
}) {
	const [criando, setCriando] = useState(false);
	const [tituloNovo, setTituloNovo] = useState("");
	const [pendente, startTransition] = useTransition();
	const { showToast } = useToast();
	const router = useRouter();

	function agir(fn: () => Promise<unknown>, erro: string) {
		startTransition(async () => {
			try {
				await fn();
				router.refresh();
			} catch (e) {
				showToast(e instanceof Error ? e.message : erro, "error");
			}
		});
	}

	return (
		<section className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-sm font-semibold text-gray-900">Checklists</h2>
				{!criando && (
					<button
						type="button"
						onClick={() => setCriando(true)}
						className="text-xs text-marca-500 hover:text-marca-700 font-medium"
					>
						+ Nova checklist
					</button>
				)}
			</div>

			{criando && (
				<div className="flex gap-2">
					<input
						autoFocus
						value={tituloNovo}
						onChange={e => setTituloNovo(e.target.value)}
						onKeyDown={e => {
							if (e.key === "Enter" && tituloNovo.trim()) {
								agir(
									() => criarChecklist(pedidoId, tituloNovo.trim()),
									"Não foi possível criar"
								);
								setTituloNovo("");
								setCriando(false);
							}
							if (e.key === "Escape") {
								setTituloNovo("");
								setCriando(false);
							}
						}}
						placeholder="Ex: Acabamento"
						className="flex-1 text-sm border border-marca-200 rounded px-2 py-1.5 outline-none focus:border-marca-400"
					/>
					<button
						type="button"
						disabled={!tituloNovo.trim() || pendente}
						onClick={() => {
							agir(
								() => criarChecklist(pedidoId, tituloNovo.trim()),
								"Não foi possível criar"
							);
							setTituloNovo("");
							setCriando(false);
						}}
						className="text-xs font-medium bg-marca-500 text-white rounded px-2.5 hover:bg-marca-600 disabled:opacity-50"
					>
						Criar
					</button>
					<button
						type="button"
						onClick={() => {
							setTituloNovo("");
							setCriando(false);
						}}
						className="text-xs text-gray-500 hover:text-gray-700 px-1"
					>
						Cancelar
					</button>
				</div>
			)}

			{checklists.length === 0 && !criando && (
				<p className="text-sm text-gray-400">
					Nenhuma checklist. Útil para quebrar o trabalho em etapas —
					impressão, acabamento, embalagem.
				</p>
			)}

			{checklists.map(cl => (
				<ChecklistBloco
					key={cl.checklist_id}
					checklist={cl}
					pendente={pendente}
					onAgir={agir}
				/>
			))}
		</section>
	);
}

function ChecklistBloco({
	checklist,
	pendente,
	onAgir,
}: {
	readonly checklist: Checklist;
	readonly pendente: boolean;
	readonly onAgir: (fn: () => Promise<unknown>, erro: string) => void;
}) {
	const [textoNovo, setTextoNovo] = useState("");

	const total = checklist.itens.length;
	const feitos = checklist.itens.filter(i => i.concluido).length;
	const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;

	function adicionar() {
		const texto = textoNovo.trim();
		if (!texto) return;
		onAgir(
			() => adicionarItemChecklist(checklist.checklist_id, texto),
			"Não foi possível adicionar"
		);
		setTextoNovo("");
	}

	return (
		<div className="border border-marca-200 rounded-lg p-3 bg-white">
			<div className="flex items-center justify-between gap-2 mb-2">
				<h3 className="text-sm font-medium text-gray-900">{checklist.titulo}</h3>
				<div className="flex items-center gap-2 shrink-0">
					<span className="text-xs text-gray-500 tabular-nums">
						{feitos}/{total}
					</span>
					<button
						type="button"
						onClick={() => {
							if (
								window.confirm(
									`Remover a checklist "${checklist.titulo}" e seus ${total} ${total === 1 ? "item" : "itens"}?`
								)
							) {
								onAgir(
									() => removerChecklist(checklist.checklist_id),
									"Não foi possível remover"
								);
							}
						}}
						title="Remover checklist"
						className="text-gray-300 hover:text-perigo text-sm leading-none"
					>
						×
					</button>
				</div>
			</div>

			{total > 0 && (
				<div className="h-1.5 bg-marca-100 rounded-full overflow-hidden mb-2.5">
					<div
						className={`h-full rounded-full transition-all ${
							pct === 100 ? "bg-sucesso" : "bg-marca-400"
						}`}
						style={{ width: `${pct}%` }}
					/>
				</div>
			)}

			<ul className="flex flex-col gap-0.5">
				{checklist.itens.map(item => (
					<li key={item.item_id} className="group flex items-start gap-2">
						<input
							type="checkbox"
							checked={item.concluido}
							disabled={pendente}
							onChange={e =>
								onAgir(
									() => marcarItemChecklist(item.item_id, e.target.checked),
									"Não foi possível marcar"
								)
							}
							className="mt-0.5 h-4 w-4 shrink-0 rounded border-marca-300 text-marca-500 focus:ring-marca-400"
						/>
						<span
							className={`flex-1 text-sm ${
								item.concluido ? "text-gray-400 line-through" : "text-gray-700"
							}`}
						>
							{item.texto}
						</span>
						<button
							type="button"
							onClick={() =>
								onAgir(
									() => removerItemChecklist(item.item_id),
									"Não foi possível remover"
								)
							}
							title="Remover item"
							className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-perigo text-sm leading-none transition-opacity"
						>
							×
						</button>
					</li>
				))}
			</ul>

			<input
				value={textoNovo}
				onChange={e => setTextoNovo(e.target.value)}
				onKeyDown={e => {
					if (e.key === "Enter") {
						e.preventDefault();
						adicionar();
					}
				}}
				onBlur={adicionar}
				placeholder="+ Adicionar item"
				className="w-full mt-2 text-sm border-0 border-b border-transparent hover:border-marca-200 focus:border-marca-400 outline-none py-1 placeholder:text-gray-400"
			/>
		</div>
	);
}
