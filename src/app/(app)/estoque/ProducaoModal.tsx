"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { registrarProducao, criarProdutoERegistrarProducao } from "./actions";

const NOVO_MODELO = "__novo__";

const schema = z
	.object({
		modelo_id: z.string().min(1, "Selecione um produto"),
		quantidade: z.string().min(1, "Quantidade obrigatoria"),
		data_producao: z.string().min(1, "Data obrigatoria"),
		observacao: z.string().optional(),
		novo_nome: z.string().optional(),
		novo_codigo: z.string().optional(),
		novo_custo_producao: z.string().optional(),
		novo_estoque_minimo: z.string().optional(),
	})
	.superRefine((val, ctx) => {
		if (val.modelo_id === NOVO_MODELO && !val.novo_nome?.trim()) {
			ctx.addIssue({
				code: "custom",
				message: "Nome do produto e obrigatorio",
				path: ["novo_nome"],
			});
		}
	});

type FormValues = z.infer<typeof schema>;

interface ModeloOption {
	modelo_id: string;
	nome: string;
	codigo: string | null;
	custo_producao: number | null;
}

interface Props {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly modelos: ModeloOption[];
}

function hojeISO() {
	return new Date().toISOString().slice(0, 10);
}

export default function ProducaoModal({ open, onClose, modelos }: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	const modeloOptions = useMemo(
		() => [
			{ value: NOVO_MODELO, label: "+ Criar novo produto" },
			...modelos.map(m => ({
				value: m.modelo_id,
				label: m.codigo ? `${m.codigo} - ${m.nome}` : m.nome,
			})),
		],
		[modelos]
	);

	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			modelo_id: "",
			quantidade: "",
			data_producao: hojeISO(),
			observacao: "",
			novo_nome: "",
			novo_codigo: "",
			novo_custo_producao: "",
			novo_estoque_minimo: "0",
		},
	});

	const modeloId = watch("modelo_id");
	const isNovo = modeloId === NOVO_MODELO;

	useEffect(() => {
		if (!open) return;
		reset({
			modelo_id: "",
			quantidade: "",
			data_producao: hojeISO(),
			observacao: "",
			novo_nome: "",
			novo_codigo: "",
			novo_custo_producao: "",
			novo_estoque_minimo: "0",
		});
	}, [open, reset]);

	const onSubmit = handleSubmit(async values => {
		const quantidade = Number.parseInt(values.quantidade, 10);

		if (!Number.isFinite(quantidade) || quantidade <= 0) {
			showToast("Quantidade invalida", "error");
			return;
		}

		setLoading(true);
		try {
			if (values.modelo_id === NOVO_MODELO) {
				await criarProdutoERegistrarProducao({
					produto: {
						nome: values.novo_nome!.trim(),
						codigo: values.novo_codigo || undefined,
						custo_producao: values.novo_custo_producao
							? Number.parseFloat(values.novo_custo_producao.replace(",", "."))
							: null,
						estoque_minimo: values.novo_estoque_minimo
							? Number.parseInt(values.novo_estoque_minimo, 10)
							: 0,
					},
					producao: {
						quantidade,
						data_producao: values.data_producao,
						observacao: values.observacao || undefined,
					},
				});
				showToast("Produto criado e producao registrada", "success");
			} else {
				await registrarProducao({
					modelo_id: values.modelo_id,
					quantidade,
					data_producao: values.data_producao,
					observacao: values.observacao || undefined,
				});
				showToast("Producao registrada", "success");
			}
			onClose();
			router.refresh();
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao registrar producao",
				"error"
			);
		} finally {
			setLoading(false);
		}
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Registrar producao"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancelar
					</Button>
					<Button type="submit" form="producao-form" loading={loading}>
						Salvar
					</Button>
				</>
			}
		>
			<form
				id="producao-form"
				onSubmit={onSubmit}
				className="flex flex-col gap-3"
			>
				<Select
					label="Produto"
					required
					options={modeloOptions}
					placeholder="Selecione um produto"
					error={errors.modelo_id?.message}
					{...register("modelo_id")}
				/>

				{isNovo && (
					<div className="rounded-md border border-[#B5D4F4] bg-[#E6F1FB] px-3 py-3 flex flex-col gap-3">
						<p className="text-xs font-semibold text-[#185FA5] uppercase tracking-wide">
							Novo produto
						</p>
						<Input
							label="Nome"
							required
							placeholder="Ex: Chaveiro coracao"
							error={errors.novo_nome?.message}
							{...register("novo_nome")}
						/>
						<div className="grid grid-cols-2 gap-2">
							<Input
								label="Codigo (opcional)"
								placeholder="Ex: M10"
								{...register("novo_codigo")}
							/>
							<Input
								label="Estoque minimo"
								type="number"
								min={0}
								{...register("novo_estoque_minimo")}
							/>
						</div>
						<Input
							label="Custo de producao (R$)"
							type="number"
							step="0.01"
							min={0}
							placeholder="0,00"
							{...register("novo_custo_producao")}
						/>
					</div>
				)}

				<Input
					label="Quantidade"
					type="number"
					required
					min={1}
					error={errors.quantidade?.message}
					{...register("quantidade")}
				/>
				<Input
					label="Data da producao"
					type="date"
					required
					error={errors.data_producao?.message}
					{...register("data_producao")}
				/>
				<div className="flex flex-col gap-1">
					<label
						className="text-[13px] text-gray-600 font-medium"
						htmlFor="obs"
					>
						Observacao
					</label>
					<textarea
						id="obs"
						rows={3}
						className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
						placeholder="Detalhes da producao (opcional)"
						{...register("observacao")}
					/>
				</div>
			</form>
		</Modal>
	);
}
