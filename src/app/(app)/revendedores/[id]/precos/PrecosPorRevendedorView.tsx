"use client";

import { useState } from "react";
import { Badge, Button, Input, Modal, useToast } from "@/components/ui";
import { definirPrecoEmMassa } from "../../actions";

export interface ProdutoPrecoRow {
	modelo_id: string;
	codigo: string;
	nome: string;
	// preço efetivo para este revendedor
	preco_efetivo: number | null;
	valor_minimo_efetivo: number | null;
	origem: "PERSONALIZADO" | "PADRÃO";
}

interface Props {
	readonly revendedorId: string;
	readonly modeloAcerto: "COMISSAO" | "VALOR_MINIMO";
	readonly produtos: ProdutoPrecoRow[];
}

function fmtBRL(v: number | null) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PrecosPorRevendedorView({
	revendedorId,
	modeloAcerto,
	produtos,
}: Props) {
	const { showToast } = useToast();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [bulkModalOpen, setBulkModalOpen] = useState(false);
	const [bulkValue, setBulkValue] = useState("");
	const [saving, setSaving] = useState(false);

	function toggleOne(id: string) {
		setSelected(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAll() {
		if (selected.size === produtos.length) setSelected(new Set());
		else setSelected(new Set(produtos.map(p => p.modelo_id)));
	}

	async function handleBulkSave() {
		const val = parseFloat(bulkValue.replace(",", "."));
		if (isNaN(val) || val <= 0) {
			showToast("Valor inválido", "error");
			return;
		}
		setSaving(true);
		try {
			await definirPrecoEmMassa(
				revendedorId,
				Array.from(selected),
				val,
				modeloAcerto === "VALOR_MINIMO" ? "valor_minimo" : "preco"
			);
			showToast(`${selected.size} produto(s) atualizado(s)`, "success");
			setSelected(new Set());
			setBulkModalOpen(false);
			setBulkValue("");
		} catch {
			showToast("Erro ao definir preços", "error");
		} finally {
			setSaving(false);
		}
	}

	const campoLabel =
		modeloAcerto === "VALOR_MINIMO" ? "Valor mínimo (R$)" : "Preço (R$)";
	const colLabel = modeloAcerto === "VALOR_MINIMO" ? "Valor mínimo" : "Preço";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold text-gray-900">
					Preços para este revendedor
				</h2>
				{selected.size > 0 && (
					<Button
						variant="primary"
						size="sm"
						onClick={() => setBulkModalOpen(true)}
					>
						Definir {campoLabel.toLowerCase()} para {selected.size} produto(s)
					</Button>
				)}
			</div>

			<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
							<th className="w-10 px-3 py-2.5 text-left">
								<input
									type="checkbox"
									checked={
										produtos.length > 0 && selected.size === produtos.length
									}
									onChange={toggleAll}
									className="rounded border-gray-300"
								/>
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Código
							</th>
							<th className="px-3 py-2.5 text-left font-medium text-gray-600">
								Produto
							</th>
							<th className="px-3 py-2.5 text-right font-medium text-gray-600">
								{colLabel}
							</th>
							<th className="px-3 py-2.5 text-center font-medium text-gray-600">
								Origem
							</th>
						</tr>
					</thead>
					<tbody>
						{produtos.length === 0 && (
							<tr>
								<td colSpan={5} className="px-3 py-8 text-center text-gray-400">
									Nenhum produto cadastrado.
								</td>
							</tr>
						)}
						{produtos.map(p => {
							const val =
								modeloAcerto === "VALOR_MINIMO"
									? p.valor_minimo_efetivo
									: p.preco_efetivo;
							return (
								<tr
									key={p.modelo_id}
									className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD]"
								>
									<td className="px-3 py-2.5">
										<input
											type="checkbox"
											checked={selected.has(p.modelo_id)}
											onChange={() => toggleOne(p.modelo_id)}
											className="rounded border-gray-300"
										/>
									</td>
									<td className="px-3 py-2.5 font-mono text-xs text-gray-500">
										{p.codigo}
									</td>
									<td className="px-3 py-2.5 text-gray-900">{p.nome}</td>
									<td className="px-3 py-2.5 text-right text-gray-700">
										{fmtBRL(val)}
									</td>
									<td className="px-3 py-2.5 text-center">
										<Badge
											variant={
												p.origem === "PERSONALIZADO" ? "info" : "neutral"
											}
										>
											{p.origem}
										</Badge>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<Modal
				open={bulkModalOpen}
				onClose={() => {
					setBulkModalOpen(false);
					setBulkValue("");
				}}
				title={`Definir ${campoLabel.toLowerCase()} em massa`}
				footer={
					<>
						<Button
							variant="ghost"
							onClick={() => {
								setBulkModalOpen(false);
								setBulkValue("");
							}}
						>
							Cancelar
						</Button>
						<Button variant="primary" onClick={handleBulkSave} loading={saving}>
							Aplicar para {selected.size} produto(s)
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-600 mb-3">
					O valor será aplicado como faixa unitária (qtd mínima = 1) para os{" "}
					<strong>{selected.size} produto(s)</strong> selecionados.
				</p>
				<Input
					label={campoLabel}
					type="number"
					step="0.01"
					min={0}
					placeholder="0,00"
					value={bulkValue}
					onChange={e => setBulkValue(e.target.value)}
				/>
			</Modal>
		</div>
	);
}
