"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, useToast } from "@/components/ui";
import { confirmarConferencia } from "../actions";

export interface FaixaPromocional {
	rotulo: string;
	quantidade_minima: number;
	preco: number;
}

export interface ConferenciaItem {
	envio_item_id: string;
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	qtd_enviada: number;
	preco_unitario: number | null;
	preco_2mais: number | null;
	valor_minimo_unit: number | null;
	promocoes: FaixaPromocional[];
}

export interface RevendedorResumo {
	revendedor_id: string;
	nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
}

interface Props {
	readonly envioId: string;
	readonly dataEnvio: string;
	readonly status: string;
	readonly revendedor: RevendedorResumo;
	readonly itens: ConferenciaItem[];
}

interface ItemState {
	qtdContada: string;
	precoCliente: string;
	promoIndex: number | null;
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(date: string) {
	return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function toNumber(v: string) {
	const n = parseFloat(v.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number) {
	return Math.max(min, Math.min(max, v));
}

function precoPadraoComissao(item: ConferenciaItem, qtdVendida: number) {
	if (qtdVendida <= 0) return 0;
	if (qtdVendida >= 2 && Number.isFinite(item.preco_2mais)) {
		return qtdVendida * (item.preco_2mais ?? 0);
	}
	return qtdVendida * (item.preco_unitario ?? 0);
}

export default function ConferenciaForm({
	envioId,
	dataEnvio,
	status,
	revendedor,
	itens,
}: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [openPromoSheet, setOpenPromoSheet] = useState(false);
	const [usarValorManual, setUsarValorManual] = useState(false);
	const [valorManual, setValorManual] = useState("");

	const [state, setState] = useState<Record<string, ItemState>>(() => {
		const initial: Record<string, ItemState> = {};
		for (const item of itens) {
			initial[item.envio_item_id] = {
				// Default assumes all units are still with the reseller until user adjusts.
				qtdContada: String(item.qtd_enviada),
				precoCliente: "",
				promoIndex: null,
			};
		}
		return initial;
	});

	const allFilled = useMemo(() => {
		return itens.every(item => state[item.envio_item_id]?.qtdContada !== "");
	}, [itens, state]);

	const resumo = useMemo(() => {
		let totalVendida = 0;
		let totalReceberValorMinimo = 0;
		let totalSugeridoComissao = 0;

		for (const item of itens) {
			const st = state[item.envio_item_id];
			const qtdContada = clamp(
				Math.floor(toNumber(st?.qtdContada ?? "0")),
				0,
				item.qtd_enviada
			);
			const qtdVendida = item.qtd_enviada - qtdContada;
			totalVendida += qtdVendida;

			if (revendedor.modelo_acerto === "VALOR_MINIMO") {
				const valorUnit = item.valor_minimo_unit ?? 0;
				totalReceberValorMinimo += qtdVendida * valorUnit;
			} else {
				const promoIndex = st?.promoIndex;
				if (
					promoIndex !== null &&
					promoIndex >= 0 &&
					item.promocoes[promoIndex]
				) {
					totalSugeridoComissao +=
						qtdVendida * item.promocoes[promoIndex].preco;
				} else {
					totalSugeridoComissao += precoPadraoComissao(item, qtdVendida);
				}
			}
		}

		return {
			totalVendida,
			totalReceberValorMinimo,
			totalSugeridoComissao,
		};
	}, [itens, revendedor.modelo_acerto, state]);

	const valorConfirmacao = useMemo(() => {
		if (revendedor.modelo_acerto === "VALOR_MINIMO")
			return resumo.totalReceberValorMinimo;
		if (usarValorManual) return Math.max(0, toNumber(valorManual));
		return resumo.totalSugeridoComissao;
	}, [resumo, revendedor.modelo_acerto, usarValorManual, valorManual]);

	async function onConfirmar() {
		if (status !== "ABERTO") {
			showToast("Este envio nao esta aberto para conferencia", "error");
			return;
		}
		if (!allFilled) {
			showToast("Preencha todas as quantidades contadas", "error");
			return;
		}

		// Se algum item tem promoção selecionada e não foi inserido valor manual,
		// usa o total sugerido (que já reflete a promoção) como valorManual para
		// garantir que o backend registre o valor correto.
		const hasPromoSelected = itens.some(
			item => state[item.envio_item_id]?.promoIndex !== null
		);
		let valorParaBackend: number | undefined;
		if (revendedor.modelo_acerto === "COMISSAO") {
			if (usarValorManual) {
				valorParaBackend = Math.max(0, toNumber(valorManual));
			} else if (hasPromoSelected) {
				valorParaBackend = resumo.totalSugeridoComissao;
			}
		}

		setSaving(true);
		try {
			await confirmarConferencia(
				envioId,
				itens.map(item => ({
					envioItemId: item.envio_item_id,
					qtdContada: clamp(
						Math.floor(toNumber(state[item.envio_item_id]?.qtdContada ?? "0")),
						0,
						item.qtd_enviada
					),
					precoCliente: state[item.envio_item_id]?.precoCliente
						? toNumber(state[item.envio_item_id].precoCliente)
						: null,
				})),
				valorParaBackend
			);

			showToast(
				`Acerto de ${fmtCurrency(valorConfirmacao)} gerado para ${revendedor.nome}`,
				"success"
			);
			router.push("/conferencias");
			router.refresh();
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao confirmar conferencia",
				"error"
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<div className="flex flex-col gap-4">
				<header className="sticky top-0 z-10 bg-[#F4F8FD] pb-2">
					<div className="rounded-xl border border-[#B5D4F4] bg-white px-4 py-3 flex items-center justify-between gap-3">
						<div>
							<p className="text-sm font-semibold text-gray-900">
								{revendedor.nome}
							</p>
							<p className="text-xs text-gray-700">
								Envio de {fmtDate(dataEnvio)}
							</p>
						</div>
						<Badge
							variant={
								revendedor.modelo_acerto === "VALOR_MINIMO" ? "success" : "info"
							}
						>
							{revendedor.modelo_acerto === "VALOR_MINIMO"
								? "Valor minimo"
								: "Comissao"}
						</Badge>
					</div>
				</header>

				<div className="flex flex-col gap-3">
					{itens.map(item => {
						const st = state[item.envio_item_id];
						const qtdContada = clamp(
							Math.floor(toNumber(st?.qtdContada ?? "0")),
							0,
							item.qtd_enviada
						);
						const qtdVendida = item.qtd_enviada - qtdContada;

						return (
							<div
								key={item.envio_item_id}
								className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3"
							>
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{item.modelo_codigo ? `${item.modelo_codigo} - ` : ""}
										{item.modelo_nome}
									</p>
									<p className="text-xs text-gray-700 mt-0.5">
										Enviado: {item.qtd_enviada} un.
									</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<Input
										label="Ainda com revendedor"
										type="number"
										placeholder="0"
										value={st?.qtdContada ?? ""}
										onChange={e =>
											setState(prev => ({
												...prev,
												[item.envio_item_id]: {
													...prev[item.envio_item_id],
													qtdContada: e.target.value,
												},
											}))
										}
									/>
									<div className="rounded-md border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 flex flex-col justify-center">
										<span className="text-xs text-gray-700">Vendido</span>
										<span className="text-lg font-semibold text-[#185FA5]">
											{qtdVendida} un.
										</span>
									</div>
								</div>

								{revendedor.modelo_acerto === "VALOR_MINIMO" && (
									<Input
										label="Valor cobrado do cliente (opcional)"
										type="number"
										step="0.01"
										placeholder="0,00"
										value={st?.precoCliente ?? ""}
										onChange={e =>
											setState(prev => ({
												...prev,
												[item.envio_item_id]: {
													...prev[item.envio_item_id],
													precoCliente: e.target.value,
												},
											}))
										}
									/>
								)}
							</div>
						);
					})}
				</div>

				{allFilled && revendedor.modelo_acerto === "VALOR_MINIMO" && (
					<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-2">
						<p className="text-sm text-[#0C447C]">
							Voce recebera:{" "}
							<strong>{fmtCurrency(resumo.totalReceberValorMinimo)}</strong>
						</p>
						<p className="text-xs text-[#185FA5]">
							{resumo.totalVendida} un. vendidas x valores minimos por item.
						</p>
						<Button onClick={onConfirmar} loading={saving}>
							Confirmar conferencia
						</Button>
					</div>
				)}

				{allFilled && revendedor.modelo_acerto === "COMISSAO" && (
					<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-3">
						<p className="text-sm text-[#0C447C]">
							Valor sugerido:{" "}
							<strong>{fmtCurrency(resumo.totalSugeridoComissao)}</strong>
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								variant="secondary"
								onClick={() => setOpenPromoSheet(true)}
							>
								Aplicar promocao
							</Button>
							<Button
								variant="ghost"
								onClick={() => setUsarValorManual(v => !v)}
							>
								Informar valor manualmente
							</Button>
						</div>
						{usarValorManual && (
							<Input
								label="Valor manual total"
								type="number"
								step="0.01"
								placeholder="0,00"
								value={valorManual}
								onChange={e => setValorManual(e.target.value)}
							/>
						)}
						<Button onClick={onConfirmar} loading={saving}>
							Confirmar
						</Button>
					</div>
				)}
			</div>

			{openPromoSheet && (
				<div className="fixed inset-0 z-50">
					<div
						className="absolute inset-0 bg-black/35"
						onClick={() => setOpenPromoSheet(false)}
						aria-hidden="true"
					/>
					<div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl border-t border-[#B5D4F4] shadow-xl max-h-[75vh] overflow-y-auto p-4 flex flex-col gap-3">
						<div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300" />
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold text-gray-900">
								Faixas promocionais
							</h2>
							<button
								type="button"
								onClick={() => setOpenPromoSheet(false)}
								className="text-xs text-[#185FA5] hover:underline"
							>
								Fechar
							</button>
						</div>

						{itens.map(item => (
							<div
								key={item.envio_item_id}
								className="rounded-lg border border-[#B5D4F4] p-3"
							>
								<p className="text-sm font-medium text-gray-900 mb-2">
									{item.modelo_nome}
								</p>
								<div className="flex flex-col gap-1">
									<label className="inline-flex items-center gap-2 text-sm text-gray-700">
										<input
											type="radio"
											name={`promo-${item.envio_item_id}`}
											checked={state[item.envio_item_id]?.promoIndex === null}
											onChange={() =>
												setState(prev => ({
													...prev,
													[item.envio_item_id]: {
														...prev[item.envio_item_id],
														promoIndex: null,
													},
												}))
											}
										/>
										Sem promocao
									</label>
									{item.promocoes.length === 0 && (
										<p className="text-xs text-gray-600 ml-6">
											Sem faixas promocionais cadastradas.
										</p>
									)}
									{item.promocoes.map((promo, idx) => (
										<label
											key={`${item.envio_item_id}-${idx}`}
											className="inline-flex items-center gap-2 text-sm text-gray-700"
										>
											<input
												type="radio"
												name={`promo-${item.envio_item_id}`}
												checked={state[item.envio_item_id]?.promoIndex === idx}
												onChange={() =>
													setState(prev => ({
														...prev,
														[item.envio_item_id]: {
															...prev[item.envio_item_id],
															promoIndex: idx,
														},
													}))
												}
											/>
											{promo.rotulo} ({promo.quantidade_minima}+):{" "}
											{fmtCurrency(promo.preco)}
										</label>
									))}
								</div>
							</div>
						))}

						<div className="pt-1">
							<Button
								className="w-full"
								onClick={() => setOpenPromoSheet(false)}
							>
								Aplicar promocao
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
