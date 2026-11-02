"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	Badge,
	Button,
	EditorMarkdown,
	Markdown,
	useToast,
} from "@/components/ui";
import { fmtBRL, fmtData, fmtDataHora, fmtTempo, hojeISO } from "@/lib/format";
import {
	CANAL_PEDIDO,
	COLUNAS_ESTEIRA,
	PRIORIDADE,
	STATUS_LABEL,
	STATUS_VARIANTE,
	colunaDoStatus,
	situacaoPrazo,
	type SituacaoPrazo,
} from "@/modules/pedido/status";
import type { CardCompleto } from "@/lib/queries/card";
import type { EtiquetaCard } from "@/lib/queries/esteira";
import { arquivarCard, atualizarCard, repetirPedido } from "../actions";
import { alternarEtiqueta, criarEtiqueta } from "../cardActions";
import Checklists from "./Checklists";
import Comentarios from "./Comentarios";

const PRAZO_TEXTO: Record<SituacaoPrazo, string> = {
	ATRASADO: "Atrasado",
	HOJE: "Entrega hoje",
	FUTURO: "No prazo",
	CUMPRIDO: "Prazo cumprido",
	SEM_PRAZO: "Sem prazo",
};

const PRAZO_ESTILO: Record<SituacaoPrazo, string> = {
	ATRASADO: "text-perigo",
	HOJE: "text-atencao",
	FUTURO: "text-gray-600",
	CUMPRIDO: "text-sucesso",
	SEM_PRAZO: "text-gray-400",
};

const CANAL_LABEL: Record<string, string> = {
	PRESENCIAL: "Presencial",
	WHATSAPP: "WhatsApp",
	INSTAGRAM: "Instagram",
	SHOPEE: "Shopee",
};

export default function CardDetalhe({
	card,
	etiquetasDisponiveis,
	membros,
}: {
	readonly card: CardCompleto;
	readonly etiquetasDisponiveis: EtiquetaCard[];
	readonly membros: Array<{ id: string; nome: string }>;
}) {
	const router = useRouter();
	const { showToast } = useToast();
	const [pendente, startTransition] = useTransition();

	const [editandoTitulo, setEditandoTitulo] = useState(false);
	const [tituloRascunho, setTituloRascunho] = useState(
		card.titulo ?? card.cliente_nome ?? ""
	);
	const [editandoDescricao, setEditandoDescricao] = useState(false);
	const [etiquetasAbertas, setEtiquetasAbertas] = useState(false);
	const [nomeEtiquetaNova, setNomeEtiquetaNova] = useState("");

	const hoje = hojeISO();
	const prazo = situacaoPrazo(card.data_prazo, hoje, {
		prazoConcluido: card.prazo_concluido,
		status: card.status,
	});
	const coluna = colunaDoStatus(card.status);
	const { financeiro } = card;

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

	const etiquetasAplicadas = new Set(card.etiquetas.map(e => e.etiqueta_id));

	return (
		<div className="flex flex-col gap-5 max-w-5xl">
			{/* ── Cabeçalho ── */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center gap-2 text-xs text-gray-500">
					<Link href="/producao" className="hover:text-marca-600">
						← Esteira
					</Link>
					<span className="text-gray-300">·</span>
					<span className="font-mono">{card.numero_pedido}</span>
					<span className="text-gray-300">·</span>
					<span>{coluna.titulo}</span>
				</div>

				{editandoTitulo ? (
					<input
						autoFocus
						value={tituloRascunho}
						onChange={e => setTituloRascunho(e.target.value)}
						onBlur={() => {
							const t = tituloRascunho.trim();
							setEditandoTitulo(false);
							if (t && t !== card.titulo) {
								agir(
									() => atualizarCard(card.pedido_id, { titulo: t }),
									"Não foi possível salvar o título"
								);
							}
						}}
						onKeyDown={e => {
							if (e.key === "Enter") e.currentTarget.blur();
							if (e.key === "Escape") {
								setTituloRascunho(card.titulo ?? "");
								setEditandoTitulo(false);
							}
						}}
						className="text-xl font-semibold text-gray-900 border-b-2 border-marca-400 outline-none bg-transparent"
					/>
				) : (
					<h1
						onClick={() => setEditandoTitulo(true)}
						title="Clique para editar"
						className="text-xl font-semibold text-gray-900 cursor-text hover:bg-marca-50 rounded px-1 -mx-1"
					>
						{card.titulo?.trim() ||
							card.cliente_nome?.trim() ||
							card.numero_pedido}
					</h1>
				)}

				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={STATUS_VARIANTE[card.status]}>
						{STATUS_LABEL[card.status]}
					</Badge>
					{card.etiquetas.map(e => (
						<span
							key={e.etiqueta_id}
							style={{ backgroundColor: e.cor }}
							className="text-[11px] text-white font-medium px-2 py-0.5 rounded-full"
						>
							{e.nome}
						</span>
					))}
					<button
						type="button"
						onClick={() => setEtiquetasAbertas(v => !v)}
						className="text-[11px] text-marca-500 hover:text-marca-700 border border-dashed border-marca-300 rounded-full px-2 py-0.5"
					>
						+ etiqueta
					</button>
				</div>

				{etiquetasAbertas && (
					<div className="border border-marca-200 rounded-lg p-2.5 bg-white flex flex-col gap-2 max-w-sm">
						{etiquetasDisponiveis.length === 0 && (
							<p className="text-xs text-gray-400">
								Nenhuma etiqueta criada ainda.
							</p>
						)}
						{etiquetasDisponiveis.map(e => {
							const aplicada = etiquetasAplicadas.has(e.etiqueta_id);
							return (
								<label
									key={e.etiqueta_id}
									className="flex items-center gap-2 cursor-pointer text-sm"
								>
									<input
										type="checkbox"
										checked={aplicada}
										disabled={pendente}
										onChange={ev =>
											agir(
												() =>
													alternarEtiqueta(
														card.pedido_id,
														e.etiqueta_id,
														ev.target.checked
													),
												"Não foi possível alterar a etiqueta"
											)
										}
										className="h-4 w-4 rounded border-marca-300 text-marca-500"
									/>
									<span
										style={{ backgroundColor: e.cor }}
										className="h-3 w-6 rounded-full"
									/>
									<span className="text-gray-700">{e.nome}</span>
								</label>
							);
						})}
						<div className="flex gap-1.5 pt-1.5 border-t border-marca-100">
							<input
								value={nomeEtiquetaNova}
								onChange={ev => setNomeEtiquetaNova(ev.target.value)}
								onKeyDown={ev => {
									if (ev.key === "Enter" && nomeEtiquetaNova.trim()) {
										const nome = nomeEtiquetaNova.trim();
										setNomeEtiquetaNova("");
										agir(async () => {
											const nova = await criarEtiqueta(nome);
											await alternarEtiqueta(
												card.pedido_id,
												nova.etiqueta_id,
												true
											);
										}, "Não foi possível criar a etiqueta");
									}
								}}
								placeholder="Nova etiqueta"
								className="flex-1 text-xs border border-marca-200 rounded px-2 py-1 outline-none focus:border-marca-400"
							/>
						</div>
					</div>
				)}
			</div>

			<div className="grid gap-5 md:grid-cols-[1fr_15rem]">
				{/* ── Coluna principal ── */}
				<div className="flex flex-col gap-6 min-w-0">
					{/* Descrição */}
					<section className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold text-gray-900">Descrição</h2>
							{!editandoDescricao && card.descricao_md && (
								<button
									type="button"
									onClick={() => setEditandoDescricao(true)}
									className="text-xs text-marca-500 hover:text-marca-700"
								>
									Editar
								</button>
							)}
						</div>

						{editandoDescricao ? (
							<EditorMarkdown
								valor={card.descricao_md ?? ""}
								salvando={pendente}
								onCancelar={() => setEditandoDescricao(false)}
								onSalvar={texto => {
									setEditandoDescricao(false);
									agir(
										() =>
											atualizarCard(card.pedido_id, { descricao_md: texto }),
										"Não foi possível salvar a descrição"
									);
								}}
							/>
						) : card.descricao_md?.trim() ? (
							<div
								onClick={() => setEditandoDescricao(true)}
								className="cursor-text hover:bg-marca-50 rounded-lg px-2 -mx-2 py-1"
							>
								<Markdown>{card.descricao_md}</Markdown>
							</div>
						) : (
							<button
								type="button"
								onClick={() => setEditandoDescricao(true)}
								className="text-left text-sm text-gray-400 border border-marca-200 rounded-lg px-3 py-2 hover:border-marca-300 transition-colors"
							>
								Adicionar uma descrição… Markdown funciona.
							</button>
						)}
					</section>

					{/* Itens — a parte que o Trello não tem */}
					<section className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold text-gray-900">
								Itens do pedido
							</h2>
							<Link
								href={`/pedidos/${card.pedido_id}`}
								className="text-xs text-marca-500 hover:text-marca-700"
							>
								Editar itens e valores
							</Link>
						</div>

						{card.itens.length === 0 ? (
							<p className="text-sm text-gray-400">
								Nenhum item. Sem itens não há valor, custo nem lucro — vale
								preencher antes de produzir.
							</p>
						) : (
							<div className="overflow-x-auto rounded-lg border border-marca-200">
								<table className="w-full text-sm">
									<thead className="bg-marca-50 text-xs text-marca-700">
										<tr>
											<th className="text-left font-medium px-2.5 py-2">Item</th>
											<th className="text-right font-medium px-2 py-2">Qtd</th>
											<th className="text-right font-medium px-2 py-2">Preço</th>
											<th className="text-right font-medium px-2 py-2">Custo</th>
											<th className="text-right font-medium px-2.5 py-2">
												Subtotal
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-marca-100">
										{card.itens.map(i => (
											<tr key={i.item_id}>
												<td className="px-2.5 py-2">
													<span className="text-gray-900">{i.descricao}</span>
													{i.tipo === "CORINGA" && (
														<span className="ml-1.5 text-[10px] text-marca-500 border border-marca-200 rounded px-1">
															sob medida
														</span>
													)}
													{(i.tempo_impressao_min || i.peso_g) && (
														<p className="text-[11px] text-gray-400 mt-0.5">
															{i.tempo_impressao_min
																? fmtTempo(i.tempo_impressao_min)
																: null}
															{i.tempo_impressao_min && i.peso_g ? " · " : null}
															{i.peso_g ? `${i.peso_g} g` : null}
														</p>
													)}
												</td>
												<td className="px-2 py-2 text-right tabular-nums text-gray-600">
													{i.quantidade}
												</td>
												<td className="px-2 py-2 text-right tabular-nums text-gray-600">
													{fmtBRL(i.preco_venda_unit)}
												</td>
												<td className="px-2 py-2 text-right tabular-nums text-gray-400">
													{fmtBRL(i.custo_unit)}
												</td>
												<td className="px-2.5 py-2 text-right tabular-nums font-medium text-gray-900">
													{fmtBRL((i.preco_venda_unit ?? 0) * i.quantidade)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}

						{financeiro.receita > 0 && (
							<dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
								<Numero rotulo="Receita" valor={fmtBRL(financeiro.receita)} />
								<Numero
									rotulo="Custo"
									valor={
										financeiro.temCustos ? fmtBRL(financeiro.custoTotal) : "—"
									}
								/>
								<Numero
									rotulo="Lucro"
									valor={financeiro.temCustos ? fmtBRL(financeiro.lucro) : "—"}
									destaque={
										financeiro.temCustos
											? financeiro.lucro >= 0
												? "sucesso"
												: "perigo"
											: undefined
									}
								/>
								<Numero
									rotulo="Margem"
									valor={
										financeiro.temCustos ? `${financeiro.margemPct}%` : "—"
									}
								/>
							</dl>
						)}
					</section>

					<Checklists pedidoId={card.pedido_id} checklists={card.checklists} />

					<Comentarios
						pedidoId={card.pedido_id}
						comentarios={card.comentarios}
					/>

					{/* Atividade */}
					<section className="flex flex-col gap-1.5">
						<h2 className="text-sm font-semibold text-gray-900">Atividade</h2>
						<ul className="text-xs text-gray-500 flex flex-col gap-1">
							<li>
								Criado em {fmtDataHora(card.created_at)}
								{card.criado_por_nome ? ` por ${card.criado_por_nome}` : ""}
							</li>
							{card.data_inicio_producao && (
								<li>Produção iniciada em {fmtData(card.data_inicio_producao)}</li>
							)}
							{card.data_conclusao_producao && (
								<li>Concluído em {fmtData(card.data_conclusao_producao)}</li>
							)}
							{card.data_entrega && (
								<li>Entregue em {fmtData(card.data_entrega)}</li>
							)}
							<li>Última alteração em {fmtDataHora(card.updated_at)}</li>
						</ul>
					</section>
				</div>

				{/* ── Barra lateral ── */}
				<aside className="flex flex-col gap-3 text-sm">
					<Campo rotulo="Prazo">
						<div className="flex flex-col gap-1.5">
							<input
								type="date"
								value={card.data_prazo?.slice(0, 10) ?? ""}
								onChange={e =>
									agir(
										() =>
											atualizarCard(card.pedido_id, {
												data_prazo: e.target.value || null,
											}),
										"Não foi possível salvar o prazo"
									)
								}
								className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
							/>
							<span className={`text-xs ${PRAZO_ESTILO[prazo]}`}>
								{PRAZO_TEXTO[prazo]}
							</span>
							{card.data_prazo && (
								<label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
									<input
										type="checkbox"
										checked={card.prazo_concluido}
										onChange={e =>
											agir(
												() =>
													atualizarCard(card.pedido_id, {
														prazo_concluido: e.target.checked,
													}),
												"Não foi possível marcar o prazo"
											)
										}
										className="h-3.5 w-3.5 rounded border-marca-300 text-marca-500"
									/>
									Cumprido
								</label>
							)}
						</div>
					</Campo>

					<Campo rotulo="Coluna">
						<select
							value={coluna.id}
							onChange={e => {
								const destino = COLUNAS_ESTEIRA.find(
									c => c.id === e.target.value
								);
								if (!destino) return;
								agir(
									() =>
										atualizarCard(card.pedido_id, {
											status: destino.statusAoEntrar,
										}),
									"Não foi possível mover"
								);
							}}
							className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
						>
							{COLUNAS_ESTEIRA.map(c => (
								<option key={c.id} value={c.id}>
									{c.titulo}
								</option>
							))}
						</select>
					</Campo>

					<Campo rotulo="Prioridade">
						<select
							value={card.prioridade}
							onChange={e =>
								agir(
									() =>
										atualizarCard(card.pedido_id, {
											prioridade: e.target
												.value as (typeof PRIORIDADE)[number],
										}),
									"Não foi possível salvar"
								)
							}
							className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
						>
							{PRIORIDADE.map(p => (
								<option key={p} value={p}>
									{p === "NORMAL" ? "Normal" : p === "ALTA" ? "Alta" : "Urgente"}
								</option>
							))}
						</select>
					</Campo>

					<Campo rotulo="Canal">
						<select
							value={card.canal}
							onChange={e =>
								agir(
									() =>
										atualizarCard(card.pedido_id, {
											canal: e.target.value as (typeof CANAL_PEDIDO)[number],
										}),
									"Não foi possível salvar"
								)
							}
							className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
						>
							{CANAL_PEDIDO.map(c => (
								<option key={c} value={c}>
									{CANAL_LABEL[c]}
								</option>
							))}
						</select>
					</Campo>

					<Campo rotulo="Responsável">
						<select
							value={card.responsavel_id ?? ""}
							onChange={e =>
								agir(
									() =>
										atualizarCard(card.pedido_id, {
											responsavel_id: e.target.value || null,
										}),
									"Não foi possível salvar"
								)
							}
							className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
						>
							<option value="">Ninguém</option>
							{membros.map(m => (
								<option key={m.id} value={m.id}>
									{m.nome}
								</option>
							))}
						</select>
					</Campo>

					<Campo rotulo="Cliente">
						<div className="flex flex-col gap-1.5">
							<input
								defaultValue={card.cliente_nome ?? ""}
								onBlur={e => {
									if (e.target.value !== (card.cliente_nome ?? "")) {
										agir(
											() =>
												atualizarCard(card.pedido_id, {
													cliente_nome: e.target.value,
												}),
											"Não foi possível salvar"
										);
									}
								}}
								placeholder="Nome"
								className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
							/>
							<input
								defaultValue={card.cliente_telefone ?? ""}
								onBlur={e => {
									if (e.target.value !== (card.cliente_telefone ?? "")) {
										agir(
											() =>
												atualizarCard(card.pedido_id, {
													cliente_telefone: e.target.value,
												}),
											"Não foi possível salvar"
										);
									}
								}}
								placeholder="Telefone"
								className="w-full border border-marca-200 rounded px-2 py-1 text-sm outline-none focus:border-marca-400"
							/>
						</div>
					</Campo>

					<div className="flex flex-col gap-1.5 pt-1">
						<Button
							variant="secondary"
							size="sm"
							loading={pendente}
							onClick={() =>
								startTransition(async () => {
									try {
										const r = await repetirPedido(card.pedido_id);
										showToast(`Criado ${r.numeroPedido}`, "success");
										router.push(`/producao/${r.pedidoId}`);
									} catch (e) {
										showToast(
											e instanceof Error ? e.message : "Não foi possível",
											"error"
										);
									}
								})
							}
						>
							Repetir pedido
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								if (
									window.confirm(
										"Arquivar este card? Ele sai da esteira, mas os dados ficam guardados."
									)
								) {
									startTransition(async () => {
										try {
											await arquivarCard(card.pedido_id);
											router.push("/producao");
										} catch (e) {
											showToast(
												e instanceof Error ? e.message : "Não foi possível",
												"error"
											);
										}
									});
								}
							}}
						>
							Arquivar
						</Button>
					</div>
				</aside>
			</div>
		</div>
	);
}

function Campo({
	rotulo,
	children,
}: {
	readonly rotulo: string;
	readonly children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[11px] font-semibold uppercase tracking-wide text-marca-600">
				{rotulo}
			</span>
			{children}
		</div>
	);
}

function Numero({
	rotulo,
	valor,
	destaque,
}: {
	readonly rotulo: string;
	readonly valor: string;
	readonly destaque?: "sucesso" | "perigo";
}) {
	const cor =
		destaque === "sucesso"
			? "text-sucesso"
			: destaque === "perigo"
				? "text-perigo"
				: "text-gray-900";
	return (
		<div className="rounded-lg border border-marca-200 bg-white px-2.5 py-1.5">
			<dt className="text-[10px] uppercase tracking-wide text-gray-400">
				{rotulo}
			</dt>
			<dd className={`text-sm font-semibold tabular-nums ${cor}`}>{valor}</dd>
		</div>
	);
}
