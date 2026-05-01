"use client";

import { useState } from "react";
import { Badge, Button, Input, Select, useToast } from "@/components/ui";
import { salvarPrecoRevendedor } from "./actions";

export interface FaixaRevendedor {
	precoUnit: number | null;
	preco2mais: number | null;
	valorMinimo: number | null;
}

export interface RevendedorOpcao {
	revendedor_id: string;
	nome: string;
	modelo_acerto: string;
}

interface Props {
	readonly modeloId: string;
	readonly revendedores: RevendedorOpcao[];
	readonly precosPorRevendedor: Record<string, FaixaRevendedor>;
}

function numStr(v: number | null) {
	return v !== null ? v.toString() : "";
}

function parseVal(s: string): number | null {
	if (!s.trim()) return null;
	const n = parseFloat(s.replace(",", "."));
	return isNaN(n) ? null : n;
}

function fmt(v: number | null) {
	if (v === null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FaixasRevendedorTab({
	modeloId,
	revendedores,
	precosPorRevendedor,
}: Props) {
	const { showToast } = useToast();
	const [selectedId, setSelectedId] = useState("");
	const [unit, setUnit] = useState("");
	const [dois, setDois] = useState("");
	const [valMin, setValMin] = useState("");
	const [saving, setSaving] = useState(false);

	const selected = revendedores.find(r => r.revendedor_id === selectedId);
	const isComissao = selected?.modelo_acerto === "COMISSAO";
	const existente = selectedId
		? (precosPorRevendedor[selectedId] ?? null)
		: null;
	const temPersonalizacao = Boolean(existente);

	function handleSelect(id: string) {
		setSelectedId(id);
		const atual = precosPorRevendedor[id] ?? null;
		setUnit(numStr(atual?.precoUnit ?? null));
		setDois(numStr(atual?.preco2mais ?? null));
		setValMin(numStr(atual?.valorMinimo ?? null));
	}

	async function handleSave() {
		if (!selectedId) return;
		setSaving(true);
		try {
			const pu = isComissao ? parseVal(unit) : null;
			const p2 = isComissao ? parseVal(dois) : null;
			const vm = !isComissao ? parseVal(valMin) : null;
			await salvarPrecoRevendedor(selectedId, modeloId, pu, p2, vm);
			showToast("Preço personalizado salvo", "success");
		} catch {
			showToast("Erro ao salvar", "error");
		} finally {
			setSaving(false);
		}
	}

	async function handleRemover() {
		if (!selectedId) return;
		setSaving(true);
		try {
			await salvarPrecoRevendedor(selectedId, modeloId, null, null, null);
			setUnit("");
			setDois("");
			setValMin("");
			showToast("Personalização removida — usando preços padrão", "success");
		} catch {
			showToast("Erro ao remover", "error");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-base font-semibold text-gray-900">
				Preços por revendedor
			</h2>

			<Select
				label="Revendedor"
				options={revendedores.map(r => ({
					value: r.revendedor_id,
					label: r.nome,
				}))}
				placeholder="Selecione um revendedor..."
				value={selectedId}
				onChange={e => handleSelect(e.target.value)}
			/>

			{selected && (
				<div className="bg-white rounded-xl border border-[#B5D4F4] p-5 flex flex-col gap-5">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 text-sm text-gray-600">
							Modelo de acerto:
							<Badge variant={isComissao ? "neutral" : "info"}>
								{isComissao ? "Comissão" : "Valor mínimo"}
							</Badge>
						</div>
						{temPersonalizacao && (
							<button
								type="button"
								onClick={handleRemover}
								disabled={saving}
								className="text-xs text-red-600 hover:underline disabled:opacity-50"
							>
								Remover personalização
							</button>
						)}
					</div>

					{!temPersonalizacao && (
						<div className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB] px-4 py-3 text-sm text-[#185FA5]">
							Usando preços padrão do produto para este revendedor.
						</div>
					)}

					{isComissao ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
							<div>
								<Input
									label="Preço unitário (R$)"
									type="number"
									step="0.01"
									min={0}
									placeholder={
										existente?.precoUnit != null
											? numStr(existente.precoUnit)
											: "Padrão do produto"
									}
									value={unit}
									onChange={e => setUnit(e.target.value)}
								/>
								{!temPersonalizacao && existente?.precoUnit == null && (
									<p className="text-xs text-gray-400 mt-1">
										Usando preço padrão
									</p>
								)}
							</div>
							<div>
								<Input
									label="Preço — 2 ou mais (R$)"
									type="number"
									step="0.01"
									min={0}
									placeholder="Padrão do produto"
									value={dois}
									onChange={e => setDois(e.target.value)}
								/>
								<p className="text-xs text-gray-400 mt-1">Opcional</p>
							</div>
						</div>
					) : (
						<div className="max-w-xs">
							<Input
								label="Valor mínimo por unidade (R$)"
								type="number"
								step="0.01"
								min={0}
								placeholder="Ex: 5,00"
								value={valMin}
								onChange={e => setValMin(e.target.value)}
							/>
							<p className="text-xs text-gray-400 mt-1">
								Valor que o revendedor deve repassar por unidade vendida.
							</p>
						</div>
					)}

					{/* Resumo dos valores efetivos */}
					{temPersonalizacao && (
						<div className="rounded-lg bg-[#F4F8FD] border border-[#B5D4F4] px-4 py-3 text-sm text-gray-700 flex gap-6 flex-wrap">
							{isComissao ? (
								<>
									<span>
										Unitário:{" "}
										<strong>{fmt(existente?.precoUnit ?? null)}</strong>
									</span>
									<span>
										2 ou mais:{" "}
										<strong>{fmt(existente?.preco2mais ?? null)}</strong>
									</span>
								</>
							) : (
								<span>
									Valor mínimo/un:{" "}
									<strong>{fmt(existente?.valorMinimo ?? null)}</strong>
								</span>
							)}
						</div>
					)}

					<div>
						<Button variant="primary" onClick={handleSave} loading={saving}>
							Salvar preço personalizado
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
