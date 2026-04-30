"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge, Button, Modal, Input, Select, useToast } from "@/components/ui";
import { criarFaixaPrecoRevendedor, deletarFaixasRevendedor } from "./actions";

export interface FaixaRevendedor {
	rev_preco_id: string;
	rotulo: string;
	quantidade_minima: number;
	preco: number | null;
	valor_minimo: number | null;
	eh_promocao: boolean;
	ativo: boolean;
}

export interface RevendedorOpcao {
	revendedor_id: string;
	nome: string;
	modelo_acerto: string;
}

interface Props {
	readonly modeloId: string;
	readonly revendedores: RevendedorOpcao[];
	readonly faixasPorRevendedor: Record<string, FaixaRevendedor[]>;
}

const schema = z.object({
	rotulo: z.string().min(1, "Rótulo obrigatório"),
	quantidade_minima: z.string().min(1),
	preco: z.string().optional(),
	valor_minimo: z.string().optional(),
	eh_promocao: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

function fmt(v: number | null) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FaixasRevendedorTab({
	modeloId,
	revendedores,
	faixasPorRevendedor,
}: Props) {
	const { showToast } = useToast();
	const [selectedId, setSelectedId] = useState<string>("");
	const [modalOpen, setModalOpen] = useState(false);
	const [saving, setSaving] = useState(false);

	const selected = revendedores.find(r => r.revendedor_id === selectedId);
	const faixas = selectedId ? (faixasPorRevendedor[selectedId] ?? []) : [];
	const isComissao = selected?.modelo_acerto === "COMISSAO";

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { eh_promocao: false, quantidade_minima: "1" },
	});

	const onSubmit = handleSubmit(async values => {
		if (!selectedId) return;
		try {
			await criarFaixaPrecoRevendedor(selectedId, modeloId, {
				rotulo: values.rotulo,
				quantidade_minima: parseInt(values.quantidade_minima, 10),
				preco: values.preco ? parseFloat(values.preco.replace(",", ".")) : 0,
				valor_minimo: values.valor_minimo
					? parseFloat(values.valor_minimo.replace(",", "."))
					: undefined,
				eh_promocao: values.eh_promocao ?? false,
			});
			showToast("Faixa criada", "success");
			reset();
			setModalOpen(false);
		} catch {
			showToast("Erro ao criar faixa", "error");
		}
	});

	async function handleReset() {
		if (!selectedId) return;
		setSaving(true);
		try {
			await deletarFaixasRevendedor(selectedId, modeloId);
			showToast("Personalização removida — usando preços padrão", "success");
		} catch {
			showToast("Erro ao resetar", "error");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-base font-semibold text-gray-900">
				Preços por revendedor
			</h2>

			{/* Seletor */}
			<Select
				label="Revendedor"
				options={revendedores.map(r => ({
					value: r.revendedor_id,
					label: r.nome,
				}))}
				placeholder="Selecione um revendedor..."
				value={selectedId}
				onChange={e => setSelectedId(e.target.value)}
			/>

			{selectedId && (
				<div className="flex flex-col gap-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<span className="text-sm text-gray-600">Modelo de acerto:</span>
							<Badge variant={isComissao ? "neutral" : "info"}>
								{isComissao ? "Comissão" : "Valor mínimo"}
							</Badge>
						</div>
						<div className="flex items-center gap-2">
							{faixas.length > 0 && (
								<Button
									variant="danger"
									size="sm"
									onClick={handleReset}
									loading={saving}
								>
									Resetar para padrão
								</Button>
							)}
							<Button
								variant="primary"
								size="sm"
								onClick={() => setModalOpen(true)}
							>
								+ Personalizar
							</Button>
						</div>
					</div>

					{faixas.length === 0 ? (
						<div className="bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg px-4 py-3 text-sm text-[#185FA5]">
							Usando preços padrão do modelo para este revendedor.
						</div>
					) : (
						<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
							<table className="w-full text-sm">
								<thead>
									<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
										<th className="px-4 py-2.5 text-left font-medium text-gray-600">
											Rótulo
										</th>
										<th className="px-4 py-2.5 text-right font-medium text-gray-600">
											Qtd mínima
										</th>
										<th className="px-4 py-2.5 text-right font-medium text-gray-600">
											{isComissao ? "Preço (R$)" : "Valor mínimo (R$)"}
										</th>
										<th className="px-4 py-2.5 text-center font-medium text-gray-600">
											Tipo
										</th>
									</tr>
								</thead>
								<tbody>
									{faixas.map(f => (
										<tr
											key={f.rev_preco_id}
											className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD] transition-colors"
										>
											<td className="px-4 py-2.5 text-gray-900">{f.rotulo}</td>
											<td className="px-4 py-2.5 text-right text-gray-700">
												{f.quantidade_minima}
											</td>
											<td className="px-4 py-2.5 text-right text-gray-700">
												{isComissao ? fmt(f.preco) : fmt(f.valor_minimo)}
											</td>
											<td className="px-4 py-2.5 text-center">
												<Badge variant={f.eh_promocao ? "warning" : "info"}>
													{f.eh_promocao ? "Promoção" : "Padrão"}
												</Badge>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>
			)}

			<Modal
				open={modalOpen}
				onClose={() => {
					setModalOpen(false);
					reset();
				}}
				title={`Personalizar preço — ${selected?.nome ?? ""}`}
				footer={
					<>
						<Button
							variant="ghost"
							onClick={() => {
								setModalOpen(false);
								reset();
							}}
						>
							Cancelar
						</Button>
						<Button
							variant="primary"
							type="submit"
							form="rev-faixa-form"
							loading={isSubmitting}
						>
							Criar faixa
						</Button>
					</>
				}
			>
				<form
					id="rev-faixa-form"
					onSubmit={onSubmit}
					className="flex flex-col gap-4"
				>
					<Input
						label="Rótulo"
						required
						error={errors.rotulo?.message}
						{...register("rotulo")}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Input
							label="Quantidade mínima"
							type="number"
							min={1}
							error={errors.quantidade_minima?.message}
							{...register("quantidade_minima")}
						/>
						{isComissao ? (
							<Input
								label="Preço (R$)"
								type="number"
								step="0.01"
								min={0}
								error={errors.preco?.message}
								{...register("preco")}
							/>
						) : (
							<Input
								label="Valor mínimo (R$)"
								type="number"
								step="0.01"
								min={0}
								error={errors.valor_minimo?.message}
								{...register("valor_minimo")}
							/>
						)}
					</div>
					<label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
						<input
							type="checkbox"
							className="rounded border-gray-300"
							{...register("eh_promocao")}
						/>
						É uma promoção
					</label>
				</form>
			</Modal>
		</div>
	);
}
