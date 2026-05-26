"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, useToast } from "@/components/ui";
import { confirmarConferencia } from "../actions";

export interface ConferenciaItem {
	envio_item_id: string;
	modelo_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	qtd_enviada: number;
	qtd_vendida: number;
	qtd_devolvida: number;
	preco_unitario: number | null;
	valor_minimo_unit: number | null;
}

export interface RevendedorResumo {
	revendedor_id: string;
	nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	comissao_fixa?: number | null;
	comissao_pct?: number | null;
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
	const [usarValorManual, setUsarValorManual] = useState(false);
	const [valorManual, setValorManual] = useState("");

	const [state, setState] = useState<Record<string, ItemState>>(() => {
		const initial: Record<string, ItemState> = {};
		for (const item of itens) {
			initial[item.envio_item_id] = {
				qtdContada: String(
					item.qtd_enviada - item.qtd_vendida - item.qtd_devolvida
				),
				precoCliente: "",
			};
		}
		return initial;
	});

	const allFilled = useMemo(() => {
		return itens
			.filter(
				item => item.qtd_enviada - item.qtd_vendida - item.qtd_devolvida > 0
			)
			.every(item => state[item.envio_item_id]?.qtdContada !== "");
	}, [itens, state]);

	const resumo = useMemo(() => {
		let totalVendidaNova = 0;
		let totalRemanentes = 0;
		let totalReceberValorMinimo = 0;
		let totalSugeridoComissao = 0;
		const linhas: { nome: string; qtd: number; valor: number }[] = [];

		for (const item of itens) {
			const qtdRestante =
				item.qtd_enviada - item.qtd_vendida - item.qtd_devolvida;
			const st = state[item.envio_item_id];
			const qtdContada = clamp(
				Math.floor(toNumber(st?.qtdContada ?? "0")),
				0,
				qtdRestante
			);
			const qtdVendidaNova = qtdRestante - qtdContada;
			totalVendidaNova += qtdVendidaNova;
			totalRemanentes += qtdContada;

			let valorItem = 0;
			if (revendedor.modelo_acerto === "VALOR_MINIMO") {
				const valorUnit = item.valor_minimo_unit ?? 0;
				valorItem = qtdVendidaNova * valorUnit;
				totalReceberValorMinimo += valorItem;
			} else {
				valorItem = precoPadraoComissao(item, qtdVendidaNova);
				totalSugeridoComissao += valorItem;
			}

			if (qtdVendidaNova > 0) {
				const nome = item.modelo_codigo
					? `${item.modelo_codigo} - ${item.modelo_nome}`
					: item.modelo_nome;
				linhas.push({ nome, qtd: qtdVendidaNova, valor: valorItem });
			}
		}

		return {
			totalVendidaNova,
			totalRemanentes,
			hasRemanentes: totalRemanentes > 0,
			totalReceberValorMinimo,
			totalSugeridoComissao,
			linhas,
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
		if (resumo.totalVendidaNova === 0) {
			showToast("Informe ao menos uma venda para confirmar", "error");
			return;
		}
		let valorParaBackend: number | undefined;
		if (revendedor.modelo_acerto === "COMISSAO" && usarValorManual) {
			valorParaBackend = Math.max(0, toNumber(valorManual));
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
				resumo.hasRemanentes
					? `Conferencia parcial salva — ${resumo.totalVendidaNova} un. vendidas`
					: `Acerto de ${fmtCurrency(valorConfirmacao)} gerado para ${revendedor.nome}`,
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

	function setQtdContada(id: string, value: string) {
		setState(prev => ({
			...prev,
			[id]: { ...prev[id], qtdContada: value },
		}));
	}

	function setPrecoCliente(id: string, value: string) {
		setState(prev => ({
			...prev,
			[id]: { ...prev[id], precoCliente: value },
		}));
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
								? "Valor por produto"
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
										id={`qtd-${item.envio_item_id}`}
										label="Ainda com revendedor"
										type="number"
										placeholder="0"
										min={0}
										max={item.qtd_enviada}
										step={1}
										value={st?.qtdContada ?? ""}
										onChange={e =>
											setQtdContada(item.envio_item_id, e.target.value)
										}
										onBlur={e => {
											if (e.target.value === "") return;
											const clamped = clamp(
												Math.floor(toNumber(e.target.value)),
												0,
												item.qtd_enviada
											);
											setQtdContada(item.envio_item_id, String(clamped));
										}}
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
										min={0}
										placeholder="0,00"
										value={st?.precoCliente ?? ""}
										onChange={e =>
											setPrecoCliente(item.envio_item_id, e.target.value)
										}
										onBlur={e => {
											if (e.target.value === "") return;
											if (toNumber(e.target.value) < 0)
												setPrecoCliente(item.envio_item_id, "0");
										}}
									/>
								)}
							</div>
						);
					})}
				</div>

				{resumo.linhas.length > 0 && (
					<div className="rounded-xl border border-[#B5D4F4] bg-white overflow-hidden">
						<div className="px-4 py-2 bg-[#F4F8FD] border-b border-[#B5D4F4]">
							<p className="text-xs font-semibold text-[#0C447C] uppercase tracking-wide">Vendidos</p>
						</div>
						<div className="text-xs">
							{resumo.linhas.map(l => (
								<div key={l.nome} className="flex items-center justify-between px-4 py-2.5 border-b border-[#E6F1FB] last:border-0">
									<span className="text-gray-800 flex-1 truncate">{l.nome}</span>
									<span className="text-gray-500 mx-3">{l.qtd} un.</span>
									<span className="font-medium text-[#185FA5]">{fmtCurrency(l.valor)}</span>
								</div>
							))}
							<div className="flex items-center justify-between px-4 py-2.5 bg-[#E6F1FB] font-semibold text-[#0C447C]">
								<span>Total</span>
								<span className="mx-3">{resumo.totalVendidaNova} un.</span>
								<span>
									{fmtCurrency(
										revendedor.modelo_acerto === "VALOR_MINIMO"
											? resumo.totalReceberValorMinimo
											: resumo.totalSugeridoComissao
									)}
								</span>
							</div>
						</div>
					</div>
				)}

				{allFilled && revendedor.modelo_acerto === "VALOR_MINIMO" && (
					<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-3">
						{resumo.hasRemanentes && (
							<p className="text-xs text-[#185FA5]">
								{resumo.totalRemanentes} un. ainda com o revendedor.
							</p>
						)}
						<Button onClick={onConfirmar} loading={saving}>
							{resumo.hasRemanentes
								? "Registrar conferencia parcial"
								: "Finalizar conferencia"}
						</Button>
					</div>
				)}

				{allFilled && revendedor.modelo_acerto === "COMISSAO" && (
					<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-4 flex flex-col gap-3">
						{resumo.hasRemanentes && (
							<p className="text-xs text-[#185FA5]">
								{resumo.totalRemanentes} un. ainda com o revendedor — o acerto
								sera atualizado a cada conferencia parcial.
							</p>
						)}
						<Button variant="ghost" onClick={() => setUsarValorManual(v => !v)}>
							Informar valor manualmente
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
							{resumo.hasRemanentes
								? "Registrar conferencia parcial"
								: "Confirmar conferencia"}
						</Button>
					</div>
				)}
			</div>
		</>
	);
}
