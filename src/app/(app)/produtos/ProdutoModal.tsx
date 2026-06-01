"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Button, Input, useToast } from "@/components/ui";
import { criarProduto, atualizarProduto } from "./actions";

const schema = z.object({
	nome: z.string().min(1, "Nome é obrigatório"),
	codigo: z.string().optional(),
	descricao: z.string().optional(),
	custo_producao: z.string().optional(),
	estoque_minimo: z.string().optional(),
	preco_unitario: z
		.string()
		.min(1, "Preço de varejo é obrigatório")
		.refine(v => Number.parseFloat(v.replace(",", ".")) > 0, "Informe um preço maior que zero"),
	preco_atacado: z.string().optional(),
	qtd_minima_atacado: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export interface ProdutoParaEditar {
	modelo_id: string;
	nome: string;
	codigo: string;
	descricao?: string | null;
	custo_producao?: number | null;
	estoque_minimo?: number | null;
	preco_unitario?: number | null;
	preco_atacado?: number | null;
	qtd_minima_atacado?: number | null;
}

export interface ProdutoInitialValues {
	nome?: string;
	custo_producao?: string;
}

interface ProdutoModalProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly produto?: ProdutoParaEditar | null;
	readonly onCreated?: (modeloId: string) => void;
	readonly initialValues?: ProdutoInitialValues;
}

export default function ProdutoModal({
	open,
	onClose,
	produto,
	onCreated,
	initialValues,
}: ProdutoModalProps) {
	const { showToast } = useToast();
	const isEdit = Boolean(produto);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (open) {
			reset(
				produto
					? {
							nome: produto.nome,
							codigo: produto.codigo,
							descricao: produto.descricao ?? "",
							custo_producao: produto.custo_producao?.toString() ?? "",
							estoque_minimo: produto.estoque_minimo?.toString() ?? "0",
							preco_unitario: produto.preco_unitario?.toString() ?? "",
							preco_atacado: produto.preco_atacado?.toString() ?? "",
							qtd_minima_atacado: produto.qtd_minima_atacado?.toString() ?? "",
						}
					: {
							nome: initialValues?.nome ?? "",
							codigo: "",
							descricao: "",
							custo_producao: initialValues?.custo_producao ?? "",
							estoque_minimo: "0",
							preco_unitario: "",
							preco_atacado: "",
							qtd_minima_atacado: "",
						}
			);
		}
	}, [open, produto, reset, initialValues]);

	const onSubmit = handleSubmit(async values => {
		try {
			const data = {
				nome: values.nome,
				codigo: values.codigo,
				descricao: values.descricao,
				custo_producao: values.custo_producao
					? Number.parseFloat(values.custo_producao.replace(",", "."))
					: null,
				estoque_minimo: values.estoque_minimo
					? Number.parseInt(values.estoque_minimo, 10)
					: 0,
				preco_unitario: values.preco_unitario
					? Number.parseFloat(values.preco_unitario.replace(",", "."))
					: null,
				preco_atacado: values.preco_atacado
					? Number.parseFloat(values.preco_atacado.replace(",", "."))
					: null,
				qtd_minima_atacado: values.qtd_minima_atacado
					? Number.parseInt(values.qtd_minima_atacado, 10)
					: null,
			};
			if (isEdit && produto) {
				await atualizarProduto(produto.modelo_id, data);
				showToast("Produto atualizado com sucesso", "success");
			} else {
				const { modeloId } = await criarProduto(data);
				showToast("Produto criado com sucesso", "success");
				onCreated?.(modeloId);
			}
			onClose();
		} catch {
			showToast("Erro ao salvar produto", "error");
		}
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={isEdit ? "Editar produto" : "Novo produto"}
			footer={
				<>
					<Button variant="ghost" onClick={onClose} type="button">
						Cancelar
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="produto-form"
						loading={isSubmitting}
					>
						{isEdit ? "Salvar alterações" : "Criar produto"}
					</Button>
				</>
			}
		>
			<form
				id="produto-form"
				onSubmit={onSubmit}
				className="flex flex-col gap-4"
			>
				<Input
					label="Nome"
					placeholder="Ex: Vaso decorativo P"
					required
					error={errors.nome?.message}
					{...register("nome")}
				/>
				<Input
					label="Código"
					placeholder="Ex: M01 (gerado automaticamente se vazio)"
					error={errors.codigo?.message}
					{...register("codigo")}
				/>
				<div className="flex flex-col gap-1">
					<label
						htmlFor="produto-descricao"
						className="text-[13px] text-gray-600 font-medium"
					>
						Descrição
					</label>
					<textarea
						id="produto-descricao"
						className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5] resize-none"
						rows={3}
						placeholder="Descrição opcional do produto"
						{...register("descricao")}
					/>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Input
						label="Custo de produção (R$)"
						placeholder="0,00"
						type="text"
						inputMode="decimal"
						error={errors.custo_producao?.message}
						{...register("custo_producao")}
					/>
					<Input
						label="Estoque mínimo"
						placeholder="0"
						type="number"
						min={0}
						error={errors.estoque_minimo?.message}
						{...register("estoque_minimo")}
					/>
				</div>
				<div className="flex flex-col gap-3 rounded-lg border border-[#B5D4F4] p-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Preços
					</p>
					<Input
						label="Varejo — preço unitário (R$)"
						placeholder="Ex: 10,00"
						type="text"
						inputMode="decimal"
						required
						error={errors.preco_unitario?.message}
						{...register("preco_unitario")}
					/>
					<div className="flex gap-3 items-end">
						<div className="flex-1">
							<Input
								label="Atacado — preço (R$)"
								placeholder="Ex: 7,50"
								type="text"
								inputMode="decimal"
								error={errors.preco_atacado?.message}
								{...register("preco_atacado")}
							/>
						</div>
						<div className="w-32 shrink-0">
							<Input
								label="A partir de (un.)"
								placeholder="Ex: 10"
								type="number"
								min={2}
								tooltip="Quantidade mínima para o preço de atacado ser aplicado"
								error={errors.qtd_minima_atacado?.message}
								{...register("qtd_minima_atacado")}
							/>
						</div>
					</div>
				</div>
			</form>
		</Modal>
	);
}
