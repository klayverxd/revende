"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorMarkdown, Markdown, useToast } from "@/components/ui";
import { fmtDataHora } from "@/lib/format";
import type { Comentario } from "@/lib/queries/card";
import { comentar, removerComentario } from "../cardActions";

/**
 * Comentários do card, em Markdown e em ordem cronológica.
 *
 * O autor vem de `criado_por` (DEFAULT auth.uid()), então funciona sem
 * cadastro de perfil: com equipe pequena, o começo do e-mail já identifica.
 */
export default function Comentarios({
	pedidoId,
	comentarios,
}: {
	readonly pedidoId: string;
	readonly comentarios: Comentario[];
}) {
	const [escrevendo, setEscrevendo] = useState(false);
	const [pendente, startTransition] = useTransition();
	const { showToast } = useToast();
	const router = useRouter();

	function enviar(texto: string) {
		const limpo = texto.trim();
		if (!limpo) return;
		startTransition(async () => {
			try {
				await comentar(pedidoId, limpo);
				setEscrevendo(false);
				router.refresh();
			} catch (e) {
				showToast(
					e instanceof Error ? e.message : "Não foi possível comentar",
					"error"
				);
			}
		});
	}

	function remover(comentarioId: string) {
		if (!window.confirm("Remover este comentário?")) return;
		startTransition(async () => {
			try {
				await removerComentario(comentarioId);
				router.refresh();
			} catch (e) {
				showToast(
					e instanceof Error ? e.message : "Não foi possível remover",
					"error"
				);
			}
		});
	}

	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-sm font-semibold text-gray-900">
				Comentários
				{comentarios.length > 0 && (
					<span className="ml-1.5 text-xs font-normal text-gray-400">
						{comentarios.length}
					</span>
				)}
			</h2>

			{escrevendo ? (
				<EditorMarkdown
					valor=""
					onSalvar={enviar}
					onCancelar={() => setEscrevendo(false)}
					placeholder="O que aconteceu com este pedido?"
					minRows={3}
					salvando={pendente}
					rotuloSalvar="Comentar"
				/>
			) : (
				<button
					type="button"
					onClick={() => setEscrevendo(true)}
					className="text-left text-sm text-gray-400 border border-marca-200 rounded-lg px-3 py-2 hover:border-marca-300 hover:text-gray-500 transition-colors"
				>
					Escrever um comentário…
				</button>
			)}

			{comentarios.length === 0 && !escrevendo && (
				<p className="text-xs text-gray-400">
					Nada registrado ainda. Serve para lembrar o que foi combinado.
				</p>
			)}

			<ul className="flex flex-col gap-3">
				{comentarios.map(c => (
					<li key={c.comentario_id} className="group flex gap-2.5">
						<span
							title={c.autor ?? "Autor desconhecido"}
							className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-marca-500 text-white text-xs font-semibold flex items-center justify-center"
						>
							{(c.autor ?? "?").trim().charAt(0).toUpperCase()}
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-baseline gap-2">
								<span className="text-xs font-medium text-gray-700">
									{c.autor ?? "—"}
								</span>
								<span className="text-[11px] text-gray-400">
									{fmtDataHora(c.created_at)}
								</span>
								<button
									type="button"
									onClick={() => remover(c.comentario_id)}
									className="ml-auto opacity-0 group-hover:opacity-100 text-[11px] text-gray-400 hover:text-perigo transition-opacity"
								>
									remover
								</button>
							</div>
							<div className="mt-0.5 bg-marca-50 rounded-lg px-2.5 py-1.5">
								<Markdown>{c.texto_md}</Markdown>
							</div>
						</div>
					</li>
				))}
			</ul>
		</section>
	);
}
