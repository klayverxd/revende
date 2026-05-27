"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Input, Modal, useToast } from "@/components/ui";
import { registrarRecebimento } from "../financeiro/actions";
import { buscarDetalheConferencia } from "./actions";

export interface RevendedorConferencia {
	revendedor_id: string;
	revendedor_nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	num_envios: number;
	total_itens: number;
	dias_mais_antigo: number;
	envios: Array<{ envio_id: string; data_envio: string; num_itens: number }>;
}

export interface AcertoPendenteCard {
	revendedor_id: string;
	revendedor_nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	total_pendente: number;
	mais_antigo: string;
	acertos: Array<{
		acerto_id: string;
		envio_id: string;
		valor_calculado: number;
		valor_a_receber: number | null;
		valor_liquido: number | null;
		comissao_calculada: number | null;
		created_at: string;
	}>;
}

export interface AcertoHistoricoRow {
	acerto_id: string;
	envio_id: string | null;
	data_recebimento: string | null;
	revendedor_nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	valor: number;
	observacao: string | null;
}

interface Props {
	readonly revendedoresComEnvios: RevendedorConferencia[];
	readonly pendentes: AcertoPendenteCard[];
	readonly historico: AcertoHistoricoRow[];
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | null) {
	if (!d) return "-";
	return new Date(d).toLocaleDateString("pt-BR");
}

function fmtR(v: number): string {
	if (Number.isInteger(v)) return `R$${v}`;
	return `R$${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type DetalheItem = Awaited<ReturnType<typeof buscarDetalheConferencia>>[number]["itens"][number];

function linhaItem(item: DetalheItem): string {
	const valor = item.modelo_acerto === "COMISSAO"
		? (item.valor_total_venda ?? 0)
		: (item.valor_a_receber ?? 0);
	if (valor <= 0) return `* ${item.modelo_nome} — ${item.qtd_vendida} un. — (sem preço)`;
	const precoUnit = item.qtd_vendida > 1 ? Number((valor / item.qtd_vendida).toFixed(2)) : null;
	const detalhe = precoUnit === null
		? `${item.qtd_vendida} un.`
		: `${item.qtd_vendida} un. × ${fmtR(precoUnit)}`;
	return `* ${item.modelo_nome} — ${detalhe} = ${fmtR(valor)}`;
}

function linhasEnvio(
	envio: Awaited<ReturnType<typeof buscarDetalheConferencia>>[number],
	idx: number,
	total: number
): string[] {
	const header = total > 1 ? [`📦 Envio ${idx + 1} (enviado em ${fmtDate(envio.data_envio)}):`] : [];
	let subtotal = 0;
	let temSemPreco = false;
	const itensLinhas = envio.itens.map(item => {
		const valor = item.modelo_acerto === "COMISSAO"
			? (item.valor_total_venda ?? 0)
			: (item.valor_a_receber ?? 0);
		if (valor > 0) subtotal += valor;
		else temSemPreco = true;
		return linhaItem(item);
	});
	const aviso = temSemPreco ? ["⚠️ Itens sem preço não foram contabilizados"] : [];
	const sub = total > 1 ? [`Subtotal: ${fmtR(subtotal)}`] : [];
	return [...header, ...itensLinhas, ...aviso, ...sub];
}

function buildRelatorio(
	card: AcertoPendenteCard,
	detalhes: Awaited<ReturnType<typeof buscarDetalheConferencia>>
): string {
	const totalComissao = card.acertos.reduce((s, a) => s + (a.comissao_calculada ?? 0), 0);
	const totalBruto = card.total_pendente + totalComissao;
	const enviosComItens = detalhes.filter(e => e.itens.length > 0);
	const totalUnidades = enviosComItens.reduce(
		(s, e) => s + e.itens.reduce((si, i) => si + i.qtd_vendida, 0),
		0
	);

	const blocos = enviosComItens.flatMap((envio, ei) => {
		const bloco = linhasEnvio(envio, ei, enviosComItens.length);
		return ei < enviosComItens.length - 1 ? [...bloco, ""] : bloco;
	});

	const totais = card.modelo_acerto === "COMISSAO"
		? [
			`📦 Total de unidades: ${totalUnidades} un.`,
			`💰 Total vendido: ${fmtR(totalBruto)}`,
			`📌 Comissão de ${totalBruto > 0 ? Math.round((totalComissao / totalBruto) * 100) : 0}%: ${fmtR(totalComissao)}`,
			`💵 Valor a receber: ${fmtR(card.total_pendente)}`,
		]
		: [
			`📦 Total de unidades: ${totalUnidades} un.`,
			`💰 Total a receber: ${fmtR(card.total_pendente)}`,
		];

	return [
		`Resumo das vendas — ${card.revendedor_nome}:`,
		"",
		...blocos,
		"",
		...totais,
	].join("\n");
}

type Tab = "CONFERIR" | "PENDENTES" | "HISTORICO";

export default function ConferenciasView({
	revendedoresComEnvios,
	pendentes,
	historico,
}: Props) {
	const { showToast } = useToast();
	const [tab, setTab] = useState<Tab>("CONFERIR");
	const [receberOpen, setReceberOpen] = useState(false);
	const [selectedCard, setSelectedCard] = useState<AcertoPendenteCard | null>(null);
	const [valorRecebido, setValorRecebido] = useState("0");
	const [observacao, setObservacao] = useState("");
	const [saving, setSaving] = useState(false);
	const [copiandoId, setCopiandoId] = useState<string | null>(null);

	const primeiroAcerto = useMemo(
		() => selectedCard?.acertos[0] ?? null,
		[selectedCard]
	);

	async function copiarRelatorio(card: AcertoPendenteCard) {
		setCopiandoId(card.revendedor_id);
		try {
			const envioIds = card.acertos.map(a => a.envio_id);
			const detalhes = await buscarDetalheConferencia(envioIds);
			await navigator.clipboard.writeText(buildRelatorio(card, detalhes));
			showToast("Relatório copiado!", "success");
		} catch {
			showToast("Erro ao gerar relatório", "error");
		} finally {
			setCopiandoId(null);
		}
	}

	function abrirRecebimento(card: AcertoPendenteCard) {
		setSelectedCard(card);
		setValorRecebido(String(card.total_pendente.toFixed(2)));
		setObservacao("");
		setReceberOpen(true);
	}

	async function confirmarRecebimento() {
		if (!primeiroAcerto) return;
		const valor = Number.parseFloat(valorRecebido.replace(",", "."));
		if (!Number.isFinite(valor) || valor < 0) {
			showToast("Valor recebido invalido", "error");
			return;
		}
		setSaving(true);
		try {
			for (const a of selectedCard?.acertos ?? []) {
				const proporcao =
					selectedCard && selectedCard.total_pendente > 0
						? a.valor_calculado / selectedCard.total_pendente
						: 0;
				const valorRateado = Number((valor * proporcao).toFixed(2));
				await registrarRecebimento(a.acerto_id, valorRateado, observacao);
			}
			showToast("Recebimento registrado", "success");
			setReceberOpen(false);
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao registrar recebimento",
				"error"
			);
		} finally {
			setSaving(false);
		}
	}

	const tabs: { key: Tab; label: string; count: number | null }[] = [
		{ key: "CONFERIR", label: "Para conferir", count: revendedoresComEnvios.length },
		{ key: "PENDENTES", label: "Recebimento pendente", count: pendentes.length },
		{ key: "HISTORICO", label: "Historico", count: null },
	];

	return (
		<>
			<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1 w-fit gap-0.5 flex-wrap">
				{tabs.map(t => (
					<button
						key={t.key}
						type="button"
						onClick={() => setTab(t.key)}
						className={[
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5",
							tab === t.key
								? "bg-[#185FA5] text-white"
								: "text-gray-700 hover:bg-[#E6F1FB]",
						].join(" ")}
					>
						{t.label}
						{t.count !== null && t.count > 0 && (
							<span
								className={[
									"inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-semibold",
									tab === t.key
										? "bg-white/20 text-white"
										: "bg-[#E6F1FB] text-[#185FA5]",
								].join(" ")}
							>
								{t.count}
							</span>
						)}
					</button>
				))}
			</div>

			{tab === "CONFERIR" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{revendedoresComEnvios.length === 0 && (
						<div className="rounded-xl border border-[#B5D4F4] bg-white p-6 text-center text-gray-600 text-sm">
							Nenhum envio aberto para conferencia.
						</div>
					)}
					{revendedoresComEnvios.map(r => (
						<Link
							key={r.revendedor_id}
							href={`/conferencias/revendedor/${r.revendedor_id}`}
							className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-2 hover:bg-[#F4F8FD] transition-colors"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{r.revendedor_nome}
									</p>
									<p className="text-xs text-gray-700 mt-0.5">
										{r.num_envios === 1
											? `1 envio · ${r.total_itens} item(ns)`
											: `${r.num_envios} envios · ${r.total_itens} item(ns) no total`}
									</p>
								</div>
								{r.dias_mais_antigo > 30 ? (
									<Badge variant="danger">{r.dias_mais_antigo} dias</Badge>
								) : (
									<Badge variant="warning">{r.dias_mais_antigo} dias</Badge>
								)}
							</div>
							<div className="flex items-center justify-between">
								<div className="flex flex-wrap gap-1">
									{r.envios.map(e => (
										<span
											key={e.envio_id}
											className="text-xs bg-[#E6F1FB] text-[#185FA5] rounded px-2 py-0.5"
										>
											{fmtDate(e.data_envio)}
										</span>
									))}
								</div>
								<Badge variant={r.modelo_acerto === "VALOR_MINIMO" ? "success" : "info"}>
									{r.modelo_acerto === "VALOR_MINIMO" ? "Valor mínimo" : "Comissão"}
								</Badge>
							</div>
						</Link>
					))}
				</div>
			)}

			{tab === "PENDENTES" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{pendentes.length === 0 && (
						<div className="rounded-xl border border-[#B5D4F4] bg-white p-6 text-sm text-gray-600 text-center">
							Nenhum acerto pendente.
						</div>
					)}
					{pendentes.map(card => {
						const totalComissao = card.acertos.reduce(
							(s, a) => s + (a.comissao_calculada ?? 0),
							0
						);
						const totalBruto = card.total_pendente + totalComissao;

						return (
							<div
								key={card.revendedor_id}
								className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3"
							>
								{/* Header */}
								<div className="flex items-start justify-between gap-2">
									<div>
										<p className="text-sm font-semibold text-gray-900">
											{card.revendedor_nome}
										</p>
										<p className="text-xs text-gray-500">
											{card.acertos.length} acerto{card.acertos.length !== 1 ? "s" : ""}{" "}
											· desde {fmtDate(card.mais_antigo)}
										</p>
									</div>
									<Badge variant={card.modelo_acerto === "COMISSAO" ? "info" : "success"}>
										{card.modelo_acerto === "COMISSAO" ? "% Comissão" : "Valor por produto"}
									</Badge>
								</div>

								{/* Breakdown */}
								<div className="rounded-lg border border-[#E6F1FB] bg-[#F4F8FD] text-xs divide-y divide-[#E6F1FB]">
									{card.modelo_acerto === "COMISSAO" ? (
										<>
											{card.acertos.length > 1 && card.acertos.map((a, i) => {
												const brutoAcerto = (a.valor_liquido ?? 0) + (a.comissao_calculada ?? 0);
												return (
													<div key={a.acerto_id} className="px-3 py-2 flex items-start justify-between gap-2 text-gray-500">
														<Link href={`/envios/${a.envio_id}`} className="text-[#378ADD] hover:underline shrink-0">
															Envio {i + 1}
														</Link>
														<div className="flex flex-col items-end gap-0.5 text-right">
															<span className="text-gray-700">{fmtCurrency(brutoAcerto)}</span>
															<span className="text-amber-600">− {fmtCurrency(a.comissao_calculada ?? 0)} com.</span>
															<span className="font-medium text-[#0C447C]">{fmtCurrency(a.valor_liquido ?? 0)}</span>
														</div>
													</div>
												);
											})}
											<div className="flex justify-between px-3 py-2 text-gray-600">
												<span>{card.acertos.length > 1 ? "Total vendas" : "Total de vendas"}</span>
												<span className="font-medium text-gray-800">{fmtCurrency(totalBruto)}</span>
											</div>
											<div className="flex justify-between px-3 py-2 text-gray-600">
												<span>Comissão</span>
												<span className="text-amber-700">− {fmtCurrency(totalComissao)}</span>
											</div>
											<div className="flex justify-between px-3 py-2 font-semibold text-[#0C447C]">
												<span>Líquido a receber</span>
												<span>{fmtCurrency(card.total_pendente)}</span>
											</div>
										</>
									) : (
										<>
											{card.acertos.length > 1 && card.acertos.map((a, i) => (
												<div key={a.acerto_id} className="px-3 py-2 flex items-center justify-between gap-2 text-gray-500">
													<Link href={`/envios/${a.envio_id}`} className="text-[#378ADD] hover:underline">
														Envio {i + 1}
													</Link>
													<span className="font-medium text-gray-700">{fmtCurrency(a.valor_calculado)}</span>
												</div>
											))}
											<div className="flex justify-between px-3 py-2 font-semibold text-[#0C447C]">
												<span>A receber</span>
												<span>{fmtCurrency(card.total_pendente)}</span>
											</div>
										</>
									)}
								</div>

								{/* Link único quando só um acerto */}
								{card.acertos.length === 1 && card.acertos[0].envio_id && (
									<Link href={`/envios/${card.acertos[0].envio_id}`} className="text-xs text-[#378ADD] hover:underline">
										Ver envio
									</Link>
								)}

								<div className="flex gap-2">
									<Button
										size="sm"
										variant="secondary"
										loading={copiandoId === card.revendedor_id}
										onClick={() => copiarRelatorio(card)}
									>
										Copiar relatório
									</Button>
									<Button size="sm" onClick={() => abrirRecebimento(card)}>
										Registrar recebimento
									</Button>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{tab === "HISTORICO" && (
				<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">Data</th>
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">Revendedor</th>
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">Tipo</th>
								<th className="px-3 py-2.5 text-right font-medium text-gray-600">Valor</th>
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">Observacao</th>
							</tr>
						</thead>
						<tbody>
							{historico.length === 0 && (
								<tr>
									<td colSpan={5} className="px-3 py-10 text-center text-gray-600">
										Sem recebimentos no historico.
									</td>
								</tr>
							)}
							{historico.map(row => (
								<tr key={row.acerto_id} className="border-b border-[#B5D4F4] last:border-0">
									<td className="px-3 py-2.5 text-gray-700">{fmtDate(row.data_recebimento)}</td>
									<td className="px-3 py-2.5 text-gray-900 font-medium">
										{row.envio_id ? (
											<Link href={`/envios/${row.envio_id}`} className="text-[#378ADD] hover:underline">
												{row.revendedor_nome}
											</Link>
										) : (
											row.revendedor_nome
										)}
									</td>
									<td className="px-3 py-2.5 text-gray-700">
										{row.modelo_acerto === "COMISSAO" ? "% Comissão" : "V. por produto"}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-900 font-semibold">
										{fmtCurrency(row.valor)}
									</td>
									<td className="px-3 py-2.5 text-gray-700">{row.observacao ?? "-"}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<Modal
				open={receberOpen}
				onClose={() => setReceberOpen(false)}
				title="Registrar recebimento"
				footer={
					<>
						<Button variant="ghost" onClick={() => setReceberOpen(false)}>
							Cancelar
						</Button>
						<Button loading={saving} onClick={confirmarRecebimento}>
							Confirmar recebimento
						</Button>
					</>
				}
			>
				{selectedCard && (
					<div className="flex flex-col gap-3">
						<p className="text-sm text-gray-700">
							Revendedor: <strong>{selectedCard.revendedor_nome}</strong>
						</p>
						<p className="text-sm text-gray-700">
							Acertos vinculados: {selectedCard.acertos.length}
						</p>
						{selectedCard.modelo_acerto === "VALOR_MINIMO" ? (
							<>
								<p className="text-sm text-gray-700">
									Valor calculado:{" "}
									<strong>{fmtCurrency(selectedCard.total_pendente)}</strong>
								</p>
								<Input
									label="Valor recebido"
									type="number"
									step="0.01"
									min={0}
									value={valorRecebido}
									onChange={e => setValorRecebido(e.target.value)}
									onBlur={e => {
										const n = Number.parseFloat(e.target.value);
										if (!Number.isFinite(n) || n < 0) setValorRecebido("0");
									}}
								/>
							</>
						) : (
							<>
								<p className="text-sm text-gray-700">
									Valor liquido:{" "}
									<strong>
										{fmtCurrency(selectedCard.acertos.reduce((a, c) => a + (c.valor_liquido ?? 0), 0))}
									</strong>
								</p>
								<p className="text-sm text-gray-700">
									Comissao calculada:{" "}
									<strong>
										{fmtCurrency(selectedCard.acertos.reduce((a, c) => a + (c.comissao_calculada ?? 0), 0))}
									</strong>
								</p>
							</>
						)}
						<div className="flex flex-col gap-1">
							<label htmlFor="obs-recebimento" className="text-[13px] text-gray-600 font-medium">
								Observacao
							</label>
							<textarea
								id="obs-recebimento"
								rows={3}
								value={observacao}
								onChange={e => setObservacao(e.target.value)}
								className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
							/>
						</div>
					</div>
				)}
			</Modal>
		</>
	);
}
