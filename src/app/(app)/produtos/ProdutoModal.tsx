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
});

type FormValues = z.infer<typeof schema>;

export interface ProdutoParaEditar {
	modelo_id: string;
	nome: string;
	codigo: string;
	descricao?: string | null;
	custo_producao?: number | null;
	estoque_minimo?: number | null;
}

interface ProdutoModalProps {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly produto?: ProdutoParaEditar | null;
}

export default function ProdutoModal({
	open,
	onClose,
	produto,
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
						}
					: {
							nome: "",
							codigo: "",
							descricao: "",
							custo_producao: "",
							estoque_minimo: "0",
						}
			);
		}
	}, [open, produto, reset]);

	const onSubmit = handleSubmit(async values => {
		try {
			const data = {
				nome: values.nome,
				codigo: values.codigo,
				descricao: values.descricao,
				custo_producao: values.custo_producao
					? parseFloat(values.custo_producao.replace(",", "."))
					: null,
				estoque_minimo: values.estoque_minimo
					? parseInt(values.estoque_minimo, 10)
					: 0,
			};
			if (isEdit && produto) {
				await atualizarProduto(produto.modelo_id, data);
				showToast("Produto atualizado com sucesso", "success");
			} else {
				await criarProduto(data);
				showToast("Produto criado com sucesso", "success");
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
					<label className="text-[13px] text-gray-600 font-medium">
						Descrição
					</label>
					<textarea
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
			</form>
		</Modal>
	);
}
