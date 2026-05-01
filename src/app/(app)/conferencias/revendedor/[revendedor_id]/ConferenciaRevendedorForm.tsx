"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, useToast } from "@/components/ui";
import { confirmarConferenciaRevendedor } from "../../actions";
import type { RevendedorResumo } from "../../[envio_id]/ConferenciaForm";

export interface ConferenciaItemMulti {
	envio_item_id: string;
	envio_id: string;
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	qtd_enviada: number;
	qtd_vendida: number;
	qtd_devolvida: number;
	preco_unitario: number | null;
	valor_minimo_unit: number | null;
}

export interface EnvioComItens {
	envio_id: string;
	data_envio: string;
	itens: ConferenciaItemMulti[];
}

interface ItemMerged {
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	total_restante: number;
	preco_unitario: number | null;
	valor_minimo_unit: number | null;
	/** envio_items ordered oldest-first (from server) */
	envio_items: ConferenciaItemMulti[];
}

interface Props {
	readonly revendedor: RevendedorResumo;
	readonly envios: EnvioComItens[];
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toNumber(v: string) {
	const n = Number.parseFloat(v.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number) {
	return Math.max(min, Math.min(max, v));
}

function qtdRestante(item: ConferenciaItemMulti) {
	return item.qtd_enviada - item.qtd_vendida - item.qtd_devolvida;
}

/** Aggregate envio_items by modelo_id across all envios. */
function computeMergedItems(envios: EnvioComItens[]): ItemMerged[] {
	const map = new Map<string, ItemMerged>();
	for (const envio of envios) {
		for (const item of envio.itens) {
			if (!map.has(item.modelo_id)) {
				map.set(item.modelo_id, {
					modelo_id: item.modelo_id,
					modelo_nome: item.modelo_nome,
					modelo_codigo: item.modelo_codigo,
					total_restante: 0,
					preco_unitario: item.preco_unitario,
					valor_minimo_unit: item.valor_minimo_unit,
					envio_items: [],
				});
			}
			const m = map.get(item.modelo_id);
			if (!m) continue;
			m.total_restante += qtdRestante(item);
			m.envio_items.push(item);
		}
	}
	return Array.from(map.values());
}

/**
 * Distribute sold/returned/remaining back to individual envio_items oldest-first.
 * Sold drains first, then returned, remaining stays in newest items.
 */
function distribuirQuantidades(
	mergedItems: ItemMerged[],
	contadaState: Record<string, string>,
	devolvidaState: Record<string, string>
): Record<string, { qtdContada: number; qtdDevolvida: number }> {
	const result: Record<string, { qtdContada: number; qtdDevolvida: number }> =
		{};
	for (const m of mergedItems) {
		const contadaTotal = clamp(
			Math.floor(toNumber(contadaState[m.modelo_id] ?? "0")),
			0,
			m.total_restante
		);
		const devolvidaTotal = clamp(
			Math.floor(toNumber(devolvidaState[m.modelo_id] ?? "0")),
			0,
			m.total_restante - contadaTotal
		);
		let vendidaRestante = m.total_restante - contadaTotal - devolvidaTotal;
		let devolvidaRestante = devolvidaTotal;
		for (const item of m.envio_items) {
			const restante = qtdRestante(item);
			const vendidaItem = Math.min(restante, vendidaRestante);
			vendidaRestante -= vendidaItem;
			const devolvidaItem = Math.min(restante - vendidaItem, devolvidaRestante);
			devolvidaRestante -= devolvidaItem;
			result[item.envio_item_id] = {
				qtdContada: restante - vendidaItem - devolvidaItem,
				qtdDevolvida: devolvidaItem,
			};
		}
	}
	return result;
}

export default function ConferenciaRevendedorForm({
	revendedor,
	envios,
}: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [usarValorManual, setUsarValorManual] = useState(false);
	const [valorManual, setValorManual] = useState("");

	const mergedItems = useMemo(() => computeMergedItems(envios), [envios]);

	// State: modelo_id → "qtd ainda com revendedor"
	const [state, setState] = useState<Record<string, string>>(() =>
		Object.fromEntries(
			computeMergedItems(envios).map(m => [
				m.modelo_id,
				String(m.total_restante),
			])
		)
	);

	// State: modelo_id → "qtd devolvida ao estoque"
	const [devolvidaState, setDevolvidaState] = useState<Record<string, string>>(
		() =>
			Object.fromEntries(
				computeMergedItems(envios).map(m => [m.modelo_id, "0"])
			)
	);

	const allFilled = useMemo(
		() =>
			mergedItems
				.filter(m => m.total_restante > 0)
				.every(m => state[m.modelo_id] !== ""),
		[mergedItems, state]
	);

	const resumoGlobal = useMemo(() => {
		let totalVendida = 0;
		let totalContada = 0;
		let totalDevolvida = 0;
		let totalReceberValorMinimo = 0;
		let totalSugeridoComissao = 0;

		for (const m of mergedItems) {
			const contada = clamp(
				Math.floor(toNumber(state[m.modelo_id] ?? "0")),
				0,
				m.total_restante
			);
			const devolvida = clamp(
				Math.floor(toNumber(devolvidaState[m.modelo_id] ?? "0")),
				0,
				m.total_restante - contada
			);
			const vendida = m.total_restante - contada - devolvida;
			totalVendida += vendida;
			totalContada += contada;
			totalDevolvida += devolvida;
			if (revendedor.modelo_acerto === "VALOR_MINIMO") {
				totalReceberValorMinimo += vendida * (m.valor_minimo_unit ?? 0);
			} else {
				totalSugeridoComissao += vendida * (m.preco_unitario ?? 0);
			}
		}

		return {
			totalVendida,
			totalContada,
			totalDevolvida,
			hasRemanentes: totalContada > 0,
			totalReceberValorMinimo,
			totalSugeridoComissao,
		};
	}, [mergedItems, revendedor.modelo_acerto, state, devolvidaState]);

	function setQtd(modeloId: string, value: string) {
		setState(prev => ({ ...prev, [modeloId]: value }));
	}

	function setDevolvida(modeloId: string, value: string) {
		setDevolvidaState(prev => ({ ...prev, [modeloId]: value }));
	}

	function buildEnviosInput(
		globalManual: number | undefined,
		perItem: Record<string, { qtdContada: number; qtdDevolvida: number }>
	) {
		const valorAutoByEnvio: Record<string, number> = {};
		for (const envio of envios) {
			let total = 0;
			for (const item of envio.itens) {
				const dist = perItem[item.envio_item_id] ?? {
					qtdContada: qtdRestante(item),
					qtdDevolvida: 0,
				};
				const vendidaItem =
					qtdRestante(item) - dist.qtdContada - dist.qtdDevolvida;
				total += vendidaItem * (item.preco_unitario ?? 0);
			}
			valorAutoByEnvio[envio.envio_id] = total;
		}
		const totalAutoComissao = Object.values(valorAutoByEnvio).reduce(
			(a, b) => a + b,
			0
		);

		return envios.map((envio, idx) => {
			const itens = envio.itens.map(item => {
				const dist = perItem[item.envio_item_id] ?? {
					qtdContada: qtdRestante(item),
					qtdDevolvida: 0,
				};
				return {
					envioItemId: item.envio_item_id,
					qtdContada: dist.qtdContada,
					qtdDevolvida: dist.qtdDevolvida,
					precoCliente: null,
				};
			});
			let valorManualEnvio: number | undefined;
			if (globalManual !== undefined) {
				if (totalAutoComissao > 0) {
					valorManualEnvio = Number(
						(
							globalManual *
							((valorAutoByEnvio[envio.envio_id] ?? 0) / totalAutoComissao)
						).toFixed(2)
					);
				} else if (idx === 0) {
					valorManualEnvio = globalManual;
				}
			}
			return { envioId: envio.envio_id, itens, valorManual: valorManualEnvio };
		});
	}

	async function onConfirmar() {
		if (!allFilled) {
			showToast("Preencha todas as quantidades", "error");
			return;
		}
		if (resumoGlobal.totalVendida === 0 && resumoGlobal.totalDevolvida === 0) {
			showToast("Informe ao menos uma venda ou devolucao", "error");
			return;
		}

		const globalManual =
			revendedor.modelo_acerto === "COMISSAO" && usarValorManual
				? Math.max(0, toNumber(valorManual))
				: undefined;

		const perItem = distribuirQuantidades(mergedItems, state, devolvidaState);
		const enviosInput = buildEnviosInput(globalManual, perItem);

		setSaving(true);
		try {
			await confirmarConferenciaRevendedor(
				revendedor.revendedor_id,
				enviosInput
			);
			const valorFinal =
				revendedor.modelo_acerto === "VALOR_MINIMO"
					? resumoGlobal.totalReceberValorMinimo
					: (globalManual ?? resumoGlobal.totalSugeridoComissao);
			const isPureReturn =
				resumoGlobal.totalVendida === 0 && resumoGlobal.totalDevolvida > 0;
			let toastMsg: string;
			if (isPureReturn) {
				toastMsg = `${resumoGlobal.totalDevolvida} un. devolvidas ao estoque`;
			} else if (resumoGlobal.hasRemanentes) {
				toastMsg = `Conferencia parcial salva — ${resumoGlobal.totalVendida} un. vendidas`;
			} else {
				toastMsg = `Conferencia concluida — ${fmtCurrency(valorFinal)} a receber de ${revendedor.nome}`;
			}
			showToast(toastMsg, "success");
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

	const itensPendentes = mergedItems.filter(m => m.total_restante > 0);

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-[#F4F8FD] pb-2">
				<div className="rounded-xl border border-[#B5D4F4] bg-white px-4 py-3 flex items-center justify-between gap-3">
					<div>
						<p className="text-sm font-semibold text-gray-900">
							{revendedor.nome}
						</p>
						<p className="text-xs text-gray-700">
							{envios.length === 1 ? "1 envio" : `${envios.length} envios`} em
							aberto
							{" · "}
							{itensPendentes.length} produto(s)
						</p>
					</div>
					<Badge
						variant={
							revendedor.modelo_acerto === "VALOR_MINIMO" ? "success" : "info"
						}
					>
						{revendedor.modelo_acerto === "VALOR_MINIMO"
							? "Valor por produto"
							: "Comissao"}
					</Badge>
				</div>
			</header>

			{/* One card per merged model */}
			{itensPendentes.map(m => {
				const qtd = state[m.modelo_id] ?? "";
				const devolvidaStr = devolvidaState[m.modelo_id] ?? "0";
				const contada =
					qtd === ""
						? 0
						: clamp(Math.floor(toNumber(qtd)), 0, m.total_restante);
				const devolvida = clamp(
					Math.floor(toNumber(devolvidaStr)),
					0,
					m.total_restante - contada
				);
				const vendida = m.total_restante - contada - devolvida;

				return (
					<div
						key={m.modelo_id}
						className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3"
					>
						<div>
							<p className="text-sm font-semibold text-gray-900">
								{m.modelo_codigo ? `${m.modelo_codigo} - ` : ""}
								{m.modelo_nome}
							</p>
							<p className="text-xs text-gray-700 mt-0.5">
								Total em aberto: {m.total_restante} un.
								{m.envio_items.length > 1 &&
									` (em ${m.envio_items.length} envios)`}
							</p>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<Input
								label="Ainda com revendedor"
								type="number"
								placeholder="0"
								min={0}
								max={m.total_restante}
								step={1}
								value={qtd}
								onChange={e => setQtd(m.modelo_id, e.target.value)}
								onBlur={e => {
									if (e.target.value === "") return;
									setQtd(
										m.modelo_id,
										String(
											clamp(
												Math.floor(toNumber(e.target.value)),
												0,
												m.total_restante
											)
										)
									);
								}}
							/>
							<Input
								label="Devolver ao estoque"
								type="number"
								placeholder="0"
								min={0}
								max={m.total_restante - contada}
								step={1}
								value={devolvidaStr}
								onChange={e => setDevolvida(m.modelo_id, e.target.value)}
								onBlur={e => {
									const v =
										e.target.value === ""
											? 0
											: Math.floor(toNumber(e.target.value));
									setDevolvida(
										m.modelo_id,
										String(clamp(v, 0, m.total_restante - contada))
									);
								}}
							/>
							<div className="rounded-md border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 flex flex-col justify-center col-span-2 sm:col-span-1">
								<span className="text-xs text-gray-700">Vendido</span>
								<span className="text-lg font-semibold text-[#185FA5]">
									{vendida} un.
								</span>
							</div>
						</div>

						{revendedor.modelo_acerto === "VALOR_MINIMO" && vendida > 0 && (
							<p className="text-xs text-gray-700">
								= {fmtCurrency(vendida * (m.valor_minimo_unit ?? 0))}
							</p>
						)}
					</div>
				);
			})}

			{/* Confirmation panel — VALOR_MINIMO */}
			{allFilled && revendedor.modelo_acerto === "VALOR_MINIMO" && (
				<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-2">
					<p className="text-sm text-[#0C447C]">
						A receber nesta conferencia:{" "}
						<strong>{fmtCurrency(resumoGlobal.totalReceberValorMinimo)}</strong>
					</p>
					<p className="text-xs text-[#185FA5]">
						{resumoGlobal.totalVendida} un. vendidas.
						{resumoGlobal.totalDevolvida > 0 &&
							` · ${resumoGlobal.totalDevolvida} un. devolvidas.`}
						{resumoGlobal.hasRemanentes &&
							` · ${resumoGlobal.totalContada} un. ainda com o revendedor.`}
					</p>
					<Button onClick={onConfirmar} loading={saving}>
						{resumoGlobal.hasRemanentes
							? "Registrar conferencia parcial"
							: "Finalizar conferencia"}
					</Button>
				</div>
			)}

			{/* Confirmation panel — COMISSAO */}
			{allFilled && revendedor.modelo_acerto === "COMISSAO" && (
				<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-3">
					<p className="text-sm text-[#0C447C]">
						Valor sugerido nesta conferencia:{" "}
						<strong>{fmtCurrency(resumoGlobal.totalSugeridoComissao)}</strong>
					</p>
					{resumoGlobal.hasRemanentes && (
						<p className="text-xs text-[#185FA5]">
							{resumoGlobal.totalContada} un. ainda com o revendedor.
						</p>
					)}
					<Button variant="ghost" onClick={() => setUsarValorManual(v => !v)}>
						{usarValorManual
							? "Usar valor calculado"
							: "Informar valor manualmente"}
					</Button>
					{usarValorManual && (
						<Input
							label="Valor manual total"
							type="number"
							step="0.01"
							min={0}
							placeholder="0,00"
							value={valorManual}
							onChange={e => setValorManual(e.target.value)}
							onBlur={e => {
								if (e.target.value !== "" && toNumber(e.target.value) < 0)
									setValorManual("0");
							}}
						/>
					)}
					<Button onClick={onConfirmar} loading={saving}>
						{resumoGlobal.hasRemanentes
							? "Registrar conferencia parcial"
							: "Confirmar conferencia"}
					</Button>
				</div>
			)}
		</div>
	);
}
