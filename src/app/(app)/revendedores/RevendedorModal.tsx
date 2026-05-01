"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, useToast } from "@/components/ui";
import {
	criarRevendedor,
	atualizarRevendedor,
	aplicarValorMinimoPadrao,
} from "./actions";

const schema = z.object({
	nome: z.string().min(1, "Nome obrigatório"),
	telefone: z.string().optional(),
	email: z.string().optional(),
	endereco: z.string().optional(),
	modelo_acerto: z.enum(["COMISSAO", "VALOR_MINIMO"]),
	comissao_fixa: z.string().optional(),
	comissao_pct: z.string().optional(),
	valor_minimo_padrao: z.string().optional(),
	aplicar_todos: z.boolean().optional(),
	sobrescrever: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export interface RevendedorParaEditar {
	revendedor_id: string;
	nome: string;
	telefone?: string | null;
	email?: string | null;
	endereco?: string | null;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	comissao_fixa?: number | null;
	comissao_pct?: number | null;
	valor_minimo_padrao?: number | null;
}

interface Props {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly revendedor?: RevendedorParaEditar | null;
}

function fmtBRL(n: number) {
	return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function RevendedorModal({ open, onClose, revendedor }: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const isEdit = !!revendedor;

	const {
		register,
		handleSubmit,
		reset,
		control,
		setValue,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			nome: "",
			telefone: "",
			email: "",
			endereco: "",
			modelo_acerto: "VALOR_MINIMO" as const,
			comissao_fixa: "0",
			comissao_pct: "0",
			valor_minimo_padrao: "",
			aplicar_todos: true,
			sobrescrever: false,
		},
	});

	const modeloAcerto = useWatch({ control, name: "modelo_acerto" });
	const comissaoFixa = useWatch({ control, name: "comissao_fixa" });
	const comissaoPct = useWatch({ control, name: "comissao_pct" });
	const valorMinimoPadrao = useWatch({ control, name: "valor_minimo_padrao" });
	const aplicarTodos = useWatch({ control, name: "aplicar_todos" });

	// Preview para COMISSAO — input é em % (ex: 30), DB armazena decimal (0.30)
	const exemploVenda = 100;
	const fixaNum = parseFloat((comissaoFixa ?? "0").replace(",", ".")) || 0;
	const pctNum = parseFloat((comissaoPct ?? "0").replace(",", ".")) || 0;
	const comissaoCalc = fixaNum + (exemploVenda * pctNum) / 100;
	const voceRecebe = exemploVenda - comissaoCalc;

	useEffect(() => {
		if (open && revendedor) {
			reset({
				nome: revendedor.nome,
				telefone: revendedor.telefone ?? "",
				email: revendedor.email ?? "",
				endereco: revendedor.endereco ?? "",
				modelo_acerto: revendedor.modelo_acerto,
				comissao_fixa: String(revendedor.comissao_fixa ?? 0),
				// BD armazena 0.30 = 30% → exibir como "30"
				comissao_pct: String(
					Math.round((revendedor.comissao_pct ?? 0) * 100 * 100) / 100
				),
				valor_minimo_padrao: revendedor.valor_minimo_padrao
					? String(revendedor.valor_minimo_padrao)
					: "",
				aplicar_todos: false,
				sobrescrever: false,
			});
		} else if (open && !revendedor) {
			reset({
				nome: "",
				telefone: "",
				email: "",
				endereco: "",
				modelo_acerto: "VALOR_MINIMO",
				comissao_fixa: "0",
				comissao_pct: "0",
				valor_minimo_padrao: "",
				aplicar_todos: true,
				sobrescrever: false,
			});
		}
	}, [open, revendedor, reset]);

	const onSubmit = handleSubmit(async values => {
		const valorMinimo = values.valor_minimo_padrao
			? parseFloat(values.valor_minimo_padrao.replace(",", ".")) || null
			: null;

		const data = {
			nome: values.nome,
			telefone: values.telefone || undefined,
			email: values.email || undefined,
			endereco: values.endereco || undefined,
			modelo_acerto: values.modelo_acerto,
			comissao_fixa:
				values.modelo_acerto === "COMISSAO"
					? parseFloat((values.comissao_fixa ?? "0").replace(",", ".")) || 0
					: 0,
			// Converter % para decimal: usuário digita "30" → salvar 0.30
			comissao_pct:
				values.modelo_acerto === "COMISSAO"
					? (parseFloat((values.comissao_pct ?? "0").replace(",", ".")) || 0) /
						100
					: 0,
			valor_minimo_padrao:
				values.modelo_acerto === "VALOR_MINIMO" ? valorMinimo : null,
		};

		try {
			if (isEdit) {
				await atualizarRevendedor(revendedor.revendedor_id, data);
				// Aplicar valor mínimo padrão se solicitado
				if (
					values.modelo_acerto === "VALOR_MINIMO" &&
					valorMinimo &&
					values.aplicar_todos
				) {
					await aplicarValorMinimoPadrao(
						revendedor.revendedor_id,
						valorMinimo,
						values.sobrescrever ?? false
					);
				}
				showToast("Revendedor atualizado", "success");
				onClose();
			} else {
				const { revendedor_id } = await criarRevendedor(data);
				// Aplicar valor mínimo padrão a todos os produtos
				if (
					values.modelo_acerto === "VALOR_MINIMO" &&
					valorMinimo &&
					values.aplicar_todos
				) {
					await aplicarValorMinimoPadrao(revendedor_id, valorMinimo, true);
				}
				showToast("Revendedor criado", "success");
				onClose();
				if (values.modelo_acerto === "VALOR_MINIMO") {
					router.push(`/revendedores/${revendedor_id}`);
				}
			}
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao salvar revendedor",
				"error"
			);
		}
	});

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={isEdit ? "Editar revendedor" : "Novo revendedor"}
			footer={
				<>
					<Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
						Cancelar
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="revendedor-form"
						loading={isSubmitting}
					>
						{isEdit ? "Salvar" : "Criar revendedor"}
					</Button>
				</>
			}
		>
			<form
				id="revendedor-form"
				onSubmit={onSubmit}
				className="flex flex-col gap-4"
			>
				{/* Dados básicos */}
				<div className="flex flex-col gap-3">
					<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
						Dados básicos
					</p>
					<Input
						label="Nome"
						required
						error={errors.nome?.message}
						{...register("nome")}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Input
							label="Telefone"
							placeholder="(11) 99999-9999"
							{...register("telefone")}
						/>
						<Input
							label="E-mail"
							type="email"
							placeholder="email@exemplo.com"
							error={errors.email?.message}
							{...register("email")}
						/>
					</div>
					<Input
						label="Endereço"
						placeholder="Rua, número, bairro..."
						{...register("endereco")}
					/>
				</div>

				{/* Modelo de acerto */}
				<div className="flex flex-col gap-3">
					<p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
						Modelo de acerto
					</p>

					<div className="flex rounded-lg border border-[#B5D4F4] overflow-hidden">
						<button
							type="button"
							onClick={() => setValue("modelo_acerto", "COMISSAO")}
							className={`flex-1 py-2 text-sm font-medium transition-colors ${
								modeloAcerto === "COMISSAO"
									? "bg-[#185FA5] text-white"
									: "bg-white text-gray-600 hover:bg-[#E6F1FB]"
							}`}
						>
							Comissão
						</button>
						<button
							type="button"
							onClick={() => setValue("modelo_acerto", "VALOR_MINIMO")}
							className={`flex-1 py-2 text-sm font-medium transition-colors ${
								modeloAcerto === "VALOR_MINIMO"
									? "bg-[#185FA5] text-white"
									: "bg-white text-gray-600 hover:bg-[#E6F1FB]"
							}`}
						>
							Valor por produto
						</button>
					</div>

					{modeloAcerto === "COMISSAO" ? (
						<div className="flex flex-col gap-3">
							<div className="grid grid-cols-2 gap-3">
								<Input
									label="Comissão fixa (R$)"
									type="number"
									step="0.01"
									min={0}
									placeholder="0,00"
									{...register("comissao_fixa")}
								/>
								<Input
									label="Comissão (%)"
									type="number"
									step="0.1"
									min={0}
									max={100}
									placeholder="0"
									{...register("comissao_pct")}
								/>
							</div>
							<div className="bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg px-3 py-2 text-sm text-[#0C447C]">
								Em uma venda de{" "}
								<span className="font-semibold">{fmtBRL(exemploVenda)}</span> →
								revendedor recebe{" "}
								<span className="font-semibold">{fmtBRL(comissaoCalc)}</span> ·
								você recebe{" "}
								<span className="font-semibold">
									{fmtBRL(Math.max(0, voceRecebe))}
								</span>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<Input
								label="Valor por produto padrão por unidade (R$)"
								type="number"
								step="0.01"
								min={0}
								placeholder="Ex: 12,00"
								hint="Será aplicado como base para todos os produtos"
								{...register("valor_minimo_padrao")}
							/>
							{valorMinimoPadrao && (
								<div className="flex flex-col gap-2 bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg px-3 py-2">
									<label className="flex items-center gap-2 text-sm text-[#0C447C] cursor-pointer">
										<input
											type="checkbox"
											className="rounded border-gray-300"
											{...register("aplicar_todos")}
										/>
										Aplicar este valor a todos os produtos agora
									</label>
									{aplicarTodos && isEdit && (
										<label className="flex items-center gap-2 text-sm text-amber-700 cursor-pointer ml-5">
											<input
												type="checkbox"
												className="rounded border-amber-300"
												{...register("sobrescrever")}
											/>
											Sobrescrever preços já personalizados
										</label>
									)}
								</div>
							)}
							{!valorMinimoPadrao && (
								<p className="text-xs text-gray-500">
									Deixe em branco para configurar individualmente na aba Preços
									de cada produto.
								</p>
							)}
						</div>
					)}
				</div>
			</form>
		</Modal>
	);
}
