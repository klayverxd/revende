"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { registrarProducao } from "./actions";

const schema = z.object({
	modelo_id: z.string().min(1, "Selecione um produto"),
	quantidade: z.string().min(1, "Quantidade obrigatoria"),
	custo_unitario: z.string().optional(),
	data_producao: z.string().min(1, "Data obrigatoria"),
	observacao: z.string().optional(),
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
		() =>
			modelos.map(m => ({
				value: m.modelo_id,
				label: m.codigo ? `${m.codigo} - ${m.nome}` : m.nome,
			})),
		[modelos]
	);

	const {
		register,
		handleSubmit,
		watch,
		setValue,
		reset,
		formState: { errors },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			modelo_id: "",
			quantidade: "",
			custo_unitario: "",
			data_producao: hojeISO(),
			observacao: "",
		},
	});

	const modeloId = watch("modelo_id");

	useEffect(() => {
		if (!open) return;
		if (!modeloId) return;
		const selected = modelos.find(m => m.modelo_id === modeloId);
		if (!selected) return;
		if (selected.custo_producao !== null) {
			setValue("custo_unitario", String(selected.custo_producao));
		}
	}, [open, modeloId, modelos, setValue]);

	useEffect(() => {
		if (!open) return;
		reset({
			modelo_id: "",
			quantidade: "",
			custo_unitario: "",
			data_producao: hojeISO(),
			observacao: "",
		});
	}, [open, reset]);

	const onSubmit = handleSubmit(async values => {
		const quantidade = parseInt(values.quantidade, 10);
		const custo = values.custo_unitario
			? parseFloat(values.custo_unitario.replace(",", "."))
			: null;

		if (!Number.isFinite(quantidade) || quantidade <= 0) {
			showToast("Quantidade invalida", "error");
			return;
		}

		setLoading(true);
		try {
			await registrarProducao({
				modelo_id: values.modelo_id,
				quantidade,
				custo_unitario: Number.isFinite(custo as number) ? custo : null,
				data_producao: values.data_producao,
				observacao: values.observacao || undefined,
			});
			showToast("Producao registrada", "success");
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
				<Input
					label="Quantidade"
					type="number"
					required
					min={1}
					error={errors.quantidade?.message}
					{...register("quantidade")}
				/>
				<Input
					label="Custo unitario (R$)"
					type="number"
					step="0.01"
					min={0}
					hint="Opcional. Pre-preenchido com o custo do produto."
					{...register("custo_unitario")}
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
