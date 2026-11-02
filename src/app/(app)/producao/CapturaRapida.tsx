"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import type { ColunaEsteira } from "@/modules/pedido/status";
import { criarCardRapido } from "./actions";

/**
 * Captura rápida: um campo, Enter, pronto.
 *
 * É a correção direta da dor que motivou esta fase — pedido que passa sem
 * anotação porque abrir o formulário completo dá trabalho no meio do
 * atendimento. Só o título é obrigatório; cliente, itens, preço e custo entram
 * depois, no card.
 *
 * O campo NÃO fecha ao salvar: quem está anotando geralmente tem mais de uma
 * coisa para anotar.
 */
export default function CapturaRapida({
	coluna,
}: {
	readonly coluna: ColunaEsteira;
}) {
	const [aberto, setAberto] = useState(false);
	const [titulo, setTitulo] = useState("");
	const [salvando, startTransition] = useTransition();
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const { showToast } = useToast();
	const router = useRouter();

	function salvar() {
		const texto = titulo.trim();
		if (!texto) return;

		startTransition(async () => {
			try {
				await criarCardRapido({ titulo: texto, colunaId: coluna.id });
				setTitulo("");
				inputRef.current?.focus();
				router.refresh();
			} catch (e) {
				showToast(
					e instanceof Error ? e.message : "Não foi possível criar o card",
					"error"
				);
			}
		});
	}

	function fechar() {
		setAberto(false);
		setTitulo("");
	}

	if (!aberto) {
		return (
			<button
				type="button"
				onClick={() => {
					setAberto(true);
					// O foco tem que esperar o textarea existir.
					requestAnimationFrame(() => inputRef.current?.focus());
				}}
				className="text-xs text-marca-500 hover:text-marca-700 hover:bg-marca-100 rounded-lg py-2 px-2 text-left transition-colors"
			>
				+ Adicionar card
			</button>
		);
	}

	return (
		<div className="bg-white rounded-lg border border-marca-300 p-2 shadow-sm">
			<textarea
				ref={inputRef}
				value={titulo}
				onChange={e => setTitulo(e.target.value)}
				onKeyDown={e => {
					// Enter salva; Shift+Enter quebra linha; Esc desiste.
					if (e.key === "Enter" && !e.shiftKey) {
						e.preventDefault();
						salvar();
					}
					if (e.key === "Escape") fechar();
				}}
				onBlur={() => {
					// Sai sem texto = desistiu. Com texto, mantém aberto para não
					// perder o que foi digitado por um clique fora acidental.
					if (!titulo.trim()) fechar();
				}}
				rows={2}
				placeholder={`Anotar em "${coluna.titulo}"…`}
				disabled={salvando}
				className="w-full text-sm resize-none outline-none placeholder:text-gray-400 disabled:opacity-60"
			/>
			<div className="flex items-center gap-2 mt-1">
				<button
					type="button"
					onClick={salvar}
					disabled={salvando || !titulo.trim()}
					className="text-xs font-medium bg-marca-500 text-white rounded px-2.5 py-1 hover:bg-marca-600 disabled:opacity-50 transition-colors"
				>
					{salvando ? "Salvando…" : "Adicionar"}
				</button>
				<button
					type="button"
					onClick={fechar}
					className="text-xs text-gray-500 hover:text-gray-700"
				>
					Cancelar
				</button>
				<span className="text-[10px] text-gray-400 ml-auto">Enter salva</span>
			</div>
		</div>
	);
}
