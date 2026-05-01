"use client";

import { useState } from "react";
import { Button, Input, useToast } from "@/components/ui";
import { salvarPrecoProduto } from "./actions";

export interface FaixaPreco {
	precoUnit: number | null;
	preco2mais: number | null;
}

interface Props {
	readonly modeloId: string;
	readonly precoUnit: number | null;
	readonly preco2mais: number | null;
}

function numStr(v: number | null) {
	return v !== null ? v.toString() : "";
}

function parseVal(s: string): number | null {
	if (!s.trim()) return null;
	const n = parseFloat(s.replace(",", "."));
	return isNaN(n) ? null : n;
}

export default function FaixasPrecoTable({
	modeloId,
	precoUnit,
	preco2mais,
}: Props) {
	const { showToast } = useToast();
	const [unit, setUnit] = useState(numStr(precoUnit));
	const [dois, setDois] = useState(numStr(preco2mais));
	const [saving, setSaving] = useState(false);

	async function handleSave() {
		setSaving(true);
		try {
			await salvarPrecoProduto(modeloId, parseVal(unit), parseVal(dois));
			showToast("Precos salvos", "success");
		} catch {
			showToast("Erro ao salvar precos", "error");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-base font-semibold text-gray-900">Precos padrao</h2>

			<div className="bg-white rounded-xl border border-[#B5D4F4] p-5">
				<p className="text-sm text-gray-500 mb-5">
					Aplicado a todos os revendedores sem preco personalizado.
				</p>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
					<div>
						<Input
							label="Preco unitario (R$)"
							type="number"
							step="0.01"
							min={0}
							placeholder="Ex: 10,00"
							value={unit}
							onChange={e => setUnit(e.target.value)}
						/>
					</div>
					<div>
						<Input
							label="Preco - 2 ou mais (R$)"
							type="number"
							step="0.01"
							min={0}
							placeholder="Ex: 8,00"
							value={dois}
							onChange={e => setDois(e.target.value)}
						/>
						<p className="text-xs text-gray-400 mt-1">
							Desconto automatico quando enviar 2+ unidades. Opcional.
						</p>
					</div>
				</div>

				<Button variant="primary" onClick={handleSave} loading={saving}>
					Salvar precos
				</Button>
			</div>
		</div>
	);
}
