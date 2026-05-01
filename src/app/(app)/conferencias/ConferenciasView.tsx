"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Input, Modal, useToast } from "@/components/ui";
import { registrarRecebimento } from "../financeiro/actions";

export interface EnvioAberto {
	envio_id: string;
	data_envio: string;
	revendedor_nome: string;
	num_itens: number;
	dias_aberto: number;
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
	readonly enviosAbertos: EnvioAberto[];
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

type Tab = "CONFERIR" | "PENDENTES" | "HISTORICO";

export default function ConferenciasView({
	enviosAbertos,
	pendentes,
	historico,
}: Props) {
	const { showToast } = useToast();
	const [tab, setTab] = useState<Tab>("CONFERIR");
	const [receberOpen, setReceberOpen] = useState(false);
	const [selectedCard, setSelectedCard] = useState<AcertoPendenteCard | null>(
		null
	);
	const [valorRecebido, setValorRecebido] = useState("0");
	const [observacao, setObservacao] = useState("");
	const [saving, setSaving] = useState(false);

	const primeiroAcerto = useMemo(
		() => selectedCard?.acertos[0] ?? null,
		[selectedCard]
	);

	function abrirRecebimento(card: AcertoPendenteCard) {
		setSelectedCard(card);
		setValorRecebido(String(card.total_pendente.toFixed(2)));
		setObservacao("");
		setReceberOpen(true);
	}

	async function confirmarRecebimento() {
		if (!primeiroAcerto) return;
		const valor = parseFloat(valorRecebido.replace(",", "."));
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
		{ key: "CONFERIR", label: "Para conferir", count: enviosAbertos.length },
		{
			key: "PENDENTES",
			label: "Recebimento pendente",
			count: pendentes.length,
		},
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
					{enviosAbertos.length === 0 && (
						<div className="rounded-xl border border-[#B5D4F4] bg-white p-6 text-center text-gray-600 text-sm">
							Nenhum envio aberto para conferencia.
						</div>
					)}
					{enviosAbertos.map(e => (
						<Link
							key={e.envio_id}
							href={`/conferencias/${e.envio_id}`}
							className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-2 hover:bg-[#F4F8FD] transition-colors"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{e.revendedor_nome}
									</p>
									<p className="text-xs text-gray-700 mt-0.5">
										Envio: {fmtDate(e.data_envio)}
									</p>
								</div>
								{e.dias_aberto > 30 ? (
									<Badge variant="danger">{e.dias_aberto} dias</Badge>
								) : (
									<Badge variant="warning">{e.dias_aberto} dias</Badge>
								)}
							</div>
							<div className="text-sm text-gray-700">
								{e.num_itens} item(ns) · toque para conferir
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
					{pendentes.map(card => (
						<div
							key={card.revendedor_id}
							className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-2"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{card.revendedor_nome}
									</p>
									<p className="text-xs text-gray-700">
										Mais antigo: {fmtDate(card.mais_antigo)}
									</p>
								</div>
								<Badge
									variant={
										card.modelo_acerto === "COMISSAO" ? "info" : "success"
									}
								>
									{card.modelo_acerto === "COMISSAO"
										? "% Comissao"
										: "Valor minimo"}
								</Badge>
							</div>
							<p className="text-sm text-gray-700">
								Total pendente:{" "}
								<strong>{fmtCurrency(card.total_pendente)}</strong>
							</p>
							<Button size="sm" onClick={() => abrirRecebimento(card)}>
								Registrar recebimento
							</Button>
						</div>
					))}
				</div>
			)}

			{tab === "HISTORICO" && (
				<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">
									Data
								</th>
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">
									Revendedor
								</th>
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">
									Tipo
								</th>
								<th className="px-3 py-2.5 text-right font-medium text-gray-600">
									Valor
								</th>
								<th className="px-3 py-2.5 text-left font-medium text-gray-600">
									Observacao
								</th>
							</tr>
						</thead>
						<tbody>
							{historico.length === 0 && (
								<tr>
									<td
										colSpan={5}
										className="px-3 py-10 text-center text-gray-600"
									>
										Sem recebimentos no historico.
									</td>
								</tr>
							)}
							{historico.map(row => (
								<tr
									key={row.acerto_id}
									className="border-b border-[#B5D4F4] last:border-0"
								>
									<td className="px-3 py-2.5 text-gray-700">
										{fmtDate(row.data_recebimento)}
									</td>
									<td className="px-3 py-2.5 text-gray-900 font-medium">
										{row.envio_id ? (
											<Link
												href={`/envios/${row.envio_id}`}
												className="text-[#378ADD] hover:underline"
											>
												{row.revendedor_nome}
											</Link>
										) : (
											row.revendedor_nome
										)}
									</td>
									<td className="px-3 py-2.5 text-gray-700">
										{row.modelo_acerto === "COMISSAO"
											? "% Comissão"
											: "Valor mín."}
									</td>
									<td className="px-3 py-2.5 text-right text-gray-900 font-semibold">
										{fmtCurrency(row.valor)}
									</td>
									<td className="px-3 py-2.5 text-gray-700">
										{row.observacao ?? "-"}
									</td>
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
										const n = parseFloat(e.target.value);
										if (!Number.isFinite(n) || n < 0) setValorRecebido("0");
									}}
								/>
							</>
						) : (
							<>
								<p className="text-sm text-gray-700">
									Valor liquido:{" "}
									<strong>
										{fmtCurrency(
											selectedCard.acertos.reduce(
												(a, c) => a + (c.valor_liquido ?? 0),
												0
											)
										)}
									</strong>
								</p>
								<p className="text-sm text-gray-700">
									Comissao calculada:{" "}
									<strong>
										{fmtCurrency(
											selectedCard.acertos.reduce(
												(a, c) => a + (c.comissao_calculada ?? 0),
												0
											)
										)}
									</strong>
								</p>
							</>
						)}
						<div className="flex flex-col gap-1">
							<label className="text-[13px] text-gray-600 font-medium">
								Observacao
							</label>
							<textarea
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
