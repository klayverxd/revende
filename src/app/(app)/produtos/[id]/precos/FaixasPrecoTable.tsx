"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge, Button, Modal, Input, useToast } from "@/components/ui";
import {
	criarFaixaPreco,
	atualizarFaixaPrecoComRevalidate,
	deletarFaixaPreco,
	toggleFaixaAtivo,
} from "./actions";

export interface FaixaPreco {
	preco_id: string;
	rotulo: string;
	quantidade_minima: number;
	preco: number;
	eh_promocao: boolean;
	ativo: boolean;
}

interface Props {
	readonly modeloId: string;
	readonly faixas: FaixaPreco[];
}

const schema = z.object({
	rotulo: z.string().min(1, "Rótulo obrigatório"),
	quantidade_minima: z.string().min(1, "Mínimo 1"),
	preco: z.string().min(1, "Preço inválido"),
	eh_promocao: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

function fmt(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FaixasPrecoTable({ modeloId, faixas }: Props) {
	const { showToast } = useToast();
	const [modalOpen, setModalOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	// inline editing
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

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
		try {
			await criarFaixaPreco(modeloId, {
				rotulo: values.rotulo,
				quantidade_minima: parseInt(values.quantidade_minima, 10),
				preco: parseFloat(values.preco.replace(",", ".")),
				eh_promocao: values.eh_promocao ?? false,
			});
			showToast("Faixa criada com sucesso", "success");
			reset();
			setModalOpen(false);
		} catch {
			showToast("Erro ao criar faixa", "error");
		}
	});

	async function saveInline(precoId: string) {
		const val = parseFloat(editValue.replace(",", "."));
		if (isNaN(val)) {
			setEditingId(null);
			return;
		}
		setSaving(true);
		try {
			await atualizarFaixaPrecoComRevalidate(precoId, modeloId, { preco: val });
			showToast("Preço atualizado", "success");
		} catch {
			showToast("Erro ao atualizar preço", "error");
		} finally {
			setSaving(false);
			setEditingId(null);
		}
	}

	async function handleDelete(precoId: string) {
		setSaving(true);
		try {
			await deletarFaixaPreco(precoId, modeloId);
			showToast("Faixa removida", "success");
		} catch {
			showToast("Erro ao remover faixa", "error");
		} finally {
			setSaving(false);
		}
	}

	async function handleToggle(precoId: string, ativo: boolean) {
		setSaving(true);
		try {
			await toggleFaixaAtivo(precoId, modeloId, !ativo);
			showToast(!ativo ? "Faixa ativada" : "Faixa desativada", "success");
		} catch {
			showToast("Erro ao alterar status", "error");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold text-gray-900">
					Faixas de preço padrão
				</h2>
				<Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
					+ Adicionar faixa
				</Button>
			</div>

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
								Preço (R$)
							</th>
							<th className="px-4 py-2.5 text-center font-medium text-gray-600">
								Tipo
							</th>
							<th className="px-4 py-2.5 text-center font-medium text-gray-600">
								Ativo
							</th>
							<th className="px-4 py-2.5 text-right font-medium text-gray-600">
								Ações
							</th>
						</tr>
					</thead>
					<tbody>
						{faixas.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-8 text-center text-gray-400">
									Nenhuma faixa cadastrada. Adicione a primeira.
								</td>
							</tr>
						)}
						{faixas.map(f => (
							<tr
								key={f.preco_id}
								className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD] transition-colors"
							>
								<td className="px-4 py-2.5 text-gray-900">{f.rotulo}</td>
								<td className="px-4 py-2.5 text-right text-gray-700">
									{f.quantidade_minima}
								</td>
								<td className="px-4 py-2.5 text-right">
									{editingId === f.preco_id ? (
										<input
											ref={inputRef}
											value={editValue}
											onChange={e => setEditValue(e.target.value)}
											onBlur={() => saveInline(f.preco_id)}
											onKeyDown={e => {
												if (e.key === "Enter") saveInline(f.preco_id);
												if (e.key === "Escape") setEditingId(null);
											}}
											className="w-24 text-right border border-[#185FA5] rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
											autoFocus
											disabled={saving}
										/>
									) : (
										<button
											className="text-gray-700 hover:text-[#185FA5] hover:underline cursor-pointer"
											onClick={() => {
												setEditingId(f.preco_id);
												setEditValue(f.preco.toString());
											}}
											title="Clique para editar"
										>
											{fmt(f.preco)}
										</button>
									)}
								</td>
								<td className="px-4 py-2.5 text-center">
									<Badge variant={f.eh_promocao ? "warning" : "info"}>
										{f.eh_promocao ? "Promoção" : "Padrão"}
									</Badge>
								</td>
								<td className="px-4 py-2.5 text-center">
									<button
										onClick={() => handleToggle(f.preco_id, f.ativo)}
										className="text-lg leading-none"
										title={f.ativo ? "Desativar" : "Ativar"}
										disabled={saving}
									>
										{f.ativo ? "✅" : "⬜"}
									</button>
								</td>
								<td className="px-4 py-2.5 text-right">
									<Button
										variant="danger"
										size="sm"
										onClick={() => handleDelete(f.preco_id)}
										disabled={saving}
									>
										Remover
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<Modal
				open={modalOpen}
				onClose={() => {
					setModalOpen(false);
					reset();
				}}
				title="Nova faixa de preço"
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
							form="faixa-form"
							loading={isSubmitting}
						>
							Criar faixa
						</Button>
					</>
				}
			>
				<form
					id="faixa-form"
					onSubmit={onSubmit}
					className="flex flex-col gap-4"
				>
					<Input
						label="Rótulo"
						placeholder="Ex: Unitário, 2 ou mais, Promoção"
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
						<Input
							label="Preço (R$)"
							type="number"
							step="0.01"
							min={0}
							placeholder="0,00"
							error={errors.preco?.message}
							{...register("preco")}
						/>
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
