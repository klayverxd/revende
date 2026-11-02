"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";

/**
 * Editor de Markdown com abas Escrever / Visualizar.
 *
 * `Ctrl+Enter` (ou `Cmd+Enter`) salva, `Esc` descarta — os atalhos que quem
 * escreve em campo de texto espera. O textarea cresce com o conteúdo para não
 * obrigar a rolar dentro de um campo pequeno.
 */
export default function EditorMarkdown({
	valor,
	onSalvar,
	onCancelar,
	placeholder = "Escreva aqui. Markdown funciona: **negrito**, listas, tabelas…",
	minRows = 4,
	salvando = false,
	rotuloSalvar = "Salvar",
}: {
	readonly valor: string;
	readonly onSalvar: (texto: string) => void;
	readonly onCancelar?: () => void;
	readonly placeholder?: string;
	readonly minRows?: number;
	readonly salvando?: boolean;
	readonly rotuloSalvar?: string;
}) {
	const [texto, setTexto] = useState(valor);
	const [aba, setAba] = useState<"escrever" | "visualizar">("escrever");
	const ref = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		setTexto(valor);
	}, [valor]);

	// Cresce com o conteúdo.
	useEffect(() => {
		const el = ref.current;
		if (!el || aba !== "escrever") return;
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}, [texto, aba]);

	const mudou = texto !== valor;

	return (
		<div className="border border-marca-200 rounded-lg overflow-hidden bg-white">
			<div className="flex items-center gap-1 border-b border-marca-100 bg-marca-50 px-1.5 py-1">
				{(["escrever", "visualizar"] as const).map(a => (
					<button
						key={a}
						type="button"
						onClick={() => setAba(a)}
						className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
							aba === a
								? "bg-white text-marca-700 shadow-sm"
								: "text-marca-500 hover:text-marca-700"
						}`}
					>
						{a === "escrever" ? "Escrever" : "Visualizar"}
					</button>
				))}
				<span className="ml-auto text-[10px] text-marca-400 pr-1 hidden sm:inline">
					Ctrl+Enter salva
				</span>
			</div>

			{aba === "escrever" ? (
				<textarea
					ref={ref}
					value={texto}
					onChange={e => setTexto(e.target.value)}
					onKeyDown={e => {
						if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
							e.preventDefault();
							onSalvar(texto);
						}
						if (e.key === "Escape" && onCancelar) {
							e.preventDefault();
							onCancelar();
						}
					}}
					rows={minRows}
					placeholder={placeholder}
					disabled={salvando}
					className="w-full px-3 py-2 text-sm resize-none outline-none min-h-24 disabled:opacity-60 placeholder:text-gray-400"
				/>
			) : (
				<div className="px-3 py-2 min-h-24">
					{texto.trim() ? (
						<Markdown>{texto}</Markdown>
					) : (
						<p className="text-sm text-gray-400">Nada para visualizar.</p>
					)}
				</div>
			)}

			<div className="flex items-center gap-2 border-t border-marca-100 px-2 py-1.5">
				<button
					type="button"
					onClick={() => onSalvar(texto)}
					disabled={salvando || !mudou}
					className="text-xs font-medium bg-marca-500 text-white rounded px-2.5 py-1 hover:bg-marca-600 disabled:opacity-50 transition-colors"
				>
					{salvando ? "Salvando…" : rotuloSalvar}
				</button>
				{onCancelar && (
					<button
						type="button"
						onClick={onCancelar}
						className="text-xs text-gray-500 hover:text-gray-700"
					>
						Cancelar
					</button>
				)}
			</div>
		</div>
	);
}
