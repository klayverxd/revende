"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Button, Input, useToast } from "@/components/ui";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ProdutoModal from "@/app/(app)/produtos/ProdutoModal";
import { criarPedido, atualizarPedido, buscarModelos } from "./actions";
import type { CanalPedido, FormaPagamento, Prioridade, StatusPagamento } from "./actions";

type ModeloOption = {
	modelo_id: string;
	codigo: string;
	nome: string;
	custo_producao: number | null;
	preco: Array<{ quantidade_minima: number; preco: number; ativo: boolean }>;
};

const itemSchema = z.object({
	tipo: z.enum(["PRODUTO", "CORINGA"]),
	modelo_id: z.string().optional(),
	descricao_custom: z.string().optional(),
	tempo_impressao_min: z.string().optional(),
	peso_g: z.string().optional(),
	num_placas: z.string().optional(),
	quantidade: z.string().min(1),
	preco_venda_unit: z.string().optional(),
	custo_unit: z.string().optional(),
	observacao: z.string().optional(),
});

const schema = z.object({
	canal: z.enum(["PRESENCIAL", "WHATSAPP", "INSTAGRAM", "SHOPEE"]),
	prioridade: z.enum(["NORMAL", "ALTA", "URGENTE"]),
	data_pedido: z.string().min(1),
	cliente_nome: z.string().optional(),
	cliente_telefone: z.string().optional(),
	cliente_email: z.string().optional(),
	cliente_referencia: z.string().optional(),
	data_prazo: z.string().optional(),
	forma_pagamento: z.enum(["PIX", "DINHEIRO", "CARTAO", "OUTRO", ""]).optional(),
	status_pagamento: z.enum(["PENDENTE", "SINAL_RECEBIDO", "PAGO"]),
	valor_sinal: z.string().optional(),
	desconto_valor: z.string().optional(),
	observacao: z.string().optional(),
	itens: z.array(itemSchema).min(1, "Adicione ao menos um item"),
});

type FormValues = z.infer<typeof schema>;

const hoje = new Date().toISOString().slice(0, 10);

export interface PedidoParaEditar {
	pedido_id: string;
	numero_pedido: string;
	canal: CanalPedido;
	prioridade: Prioridade;
	data_pedido: string;
	cliente_nome: string | null;
	cliente_telefone: string | null;
	cliente_email: string | null;
	cliente_referencia: string | null;
	data_prazo: string | null;
	forma_pagamento: FormaPagamento | null;
	status_pagamento: StatusPagamento;
	valor_sinal: number | null;
	desconto_valor: number | null;
	observacao: string | null;
	itens: Array<{
		tipo: "PRODUTO" | "CORINGA";
		modelo_id: string | null;
		descricao_custom: string | null;
		tempo_impressao_min: number | null;
		peso_g: number | null;
		num_placas: number | null;
		quantidade: number;
		preco_venda_unit: number | null;
		custo_unit: number | null;
		observacao: string | null;
	}>;
}

interface Props {
	readonly open: boolean;
	readonly onClose: () => void;
	readonly pedido?: PedidoParaEditar | null;
}

function numStr(v: number | null | undefined) {
	return v == null ? "" : String(v);
}

function parseNum(s: string | undefined) {
	if (!s?.trim()) return null;
	return Number.parseFloat(s.replace(",", "."));
}
function parseInt2(s: string | undefined) {
	if (!s?.trim()) return null;
	return Number.parseInt(s, 10);
}

export default function PedidoModal({ open, onClose, pedido }: Props) {
	const { showToast } = useToast();
	const router = useRouter();
	const isEdit = Boolean(pedido);
	const [modelos, setModelos] = useState<ModeloOption[]>([]);
	const [criarProdutoIdx, setCriarProdutoIdx] = useState<number | null>(null);

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
			canal: "PRESENCIAL",
			prioridade: "NORMAL",
			data_pedido: hoje,
			data_prazo: hoje,
			forma_pagamento: "PIX",
			status_pagamento: "PENDENTE",
			itens: [],
		},
	});

	const { fields, append, remove } = useFieldArray({ control, name: "itens" });
	const watchItens = useWatch({ control, name: "itens" });
	const watchDesconto = useWatch({ control, name: "desconto_valor" });

	function recarregarModelos() {
		return buscarModelos().then(setModelos);
	}

	useEffect(() => {
		recarregarModelos();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function handleProdutoCriado(modeloId: string, idx: number) {
		await recarregarModelos();
		onModeloChange(idx, modeloId);
		setCriarProdutoIdx(null);
	}

	useEffect(() => {
		if (!open) return;
		if (pedido) {
			reset({
				canal: pedido.canal,
				prioridade: pedido.prioridade,
				data_pedido: pedido.data_pedido,
				cliente_nome: pedido.cliente_nome ?? "",
				cliente_telefone: pedido.cliente_telefone ?? "",
				cliente_email: pedido.cliente_email ?? "",
				cliente_referencia: pedido.cliente_referencia ?? "",
				data_prazo: pedido.data_prazo ?? "",
				forma_pagamento: pedido.forma_pagamento ?? "PIX",
				status_pagamento: pedido.status_pagamento,
				valor_sinal: numStr(pedido.valor_sinal),
				desconto_valor: numStr(pedido.desconto_valor),
				observacao: pedido.observacao ?? "",
				itens: pedido.itens.map(i => ({
					tipo: i.tipo,
					modelo_id: i.modelo_id ?? "",
					descricao_custom: i.descricao_custom ?? "",
					tempo_impressao_min: numStr(i.tempo_impressao_min),
					peso_g: numStr(i.peso_g),
					num_placas: numStr(i.num_placas),
					quantidade: String(i.quantidade),
					preco_venda_unit: numStr(i.preco_venda_unit),
					custo_unit: numStr(i.custo_unit),
					observacao: i.observacao ?? "",
				})),
			});
		} else {
			reset({
				canal: "PRESENCIAL",
				prioridade: "NORMAL",
				data_pedido: hoje,
				data_prazo: hoje,
				forma_pagamento: "PIX",
				status_pagamento: "PENDENTE",
				itens: [],
			});
		}
	}, [open, pedido, reset]);

	const subtotal = (watchItens ?? []).reduce((acc, item) => {
		const preco = parseNum(item?.preco_venda_unit) ?? 0;
		const qty = parseInt2(item?.quantidade) ?? 0;
		return acc + preco * qty;
	}, 0);
	const desconto = parseNum(watchDesconto) ?? 0;
	const total = Math.max(0, subtotal - desconto);

	function adicionarItem(tipo: "PRODUTO" | "CORINGA") {
		append({
			tipo,
			modelo_id: "",
			descricao_custom: "",
			tempo_impressao_min: "",
			peso_g: "",
			num_placas: "",
			quantidade: "1",
			preco_venda_unit: "",
			custo_unit: "",
			observacao: "",
		});
	}

	function onModeloChange(idx: number, modeloId: string) {
		setValue(`itens.${idx}.modelo_id`, modeloId);
		const m = modelos.find(m => m.modelo_id === modeloId);
		const preco1 = m?.preco.find(p => p.quantidade_minima === 1 && p.ativo);
		setValue(`itens.${idx}.preco_venda_unit`, preco1 ? String(preco1.preco) : "");
		setValue(`itens.${idx}.custo_unit`, m?.custo_producao == null ? "" : String(m.custo_producao));
	}

	const onSubmit = handleSubmit(async values => {
		try {
			const itens = values.itens.map(item => ({
				tipo: item.tipo,
				modelo_id: item.tipo === "PRODUTO" ? item.modelo_id || null : null,
				descricao_custom:
					item.tipo === "CORINGA" ? item.descricao_custom || null : null,
				tempo_impressao_min: parseInt2(item.tempo_impressao_min),
				peso_g: parseNum(item.peso_g),
				num_placas: parseInt2(item.num_placas),
				quantidade: parseInt2(item.quantidade) ?? 1,
				preco_venda_unit: parseNum(item.preco_venda_unit),
				custo_unit: parseNum(item.custo_unit),
				observacao: item.observacao || null,
			}));

			const payload = {
				canal: values.canal,
				prioridade: values.prioridade,
				data_pedido: values.data_pedido,
				cliente_nome: values.cliente_nome || null,
				cliente_telefone: values.cliente_telefone || null,
				cliente_email: values.cliente_email || null,
				cliente_referencia: values.cliente_referencia || null,
				data_prazo: values.data_prazo || null,
				forma_pagamento: values.forma_pagamento || null,
				status_pagamento: values.status_pagamento,
				valor_sinal: parseNum(values.valor_sinal),
				desconto_valor: parseNum(values.desconto_valor),
				observacao: values.observacao || null,
				itens,
			};

			if (isEdit && pedido) {
				await atualizarPedido(pedido.pedido_id, payload);
				showToast("Pedido atualizado", "success");
				router.refresh();
			} else {
				const { pedidoId } = await criarPedido(payload);
				showToast("Pedido criado com sucesso", "success");
				router.push(`/pedidos/${pedidoId}`);
			}
			onClose();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Erro desconhecido";
			console.error("[PedidoModal]", msg);
			showToast(`Erro: ${msg}`, "error");
		}
	});

	return (
		<>
		<Modal
			open={open}
			onClose={onClose}
			title={isEdit ? `Editar ${pedido?.numero_pedido}` : "Novo pedido"}
			footer={
				<>
					<Button variant="ghost" onClick={onClose} type="button">
						Cancelar
					</Button>
					<Button
						variant="primary"
						type="submit"
						form="pedido-form"
						loading={isSubmitting}
					>
						{isEdit ? "Salvar alterações" : "Criar pedido"}
					</Button>
				</>
			}
		>
			<form id="pedido-form" onSubmit={onSubmit} className="flex flex-col gap-5">
				{/* Identificação */}
				<Section label="Identificação">
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1">
							<label htmlFor="pedido-canal" className="text-[13px] text-gray-600 font-medium">
								Canal <span className="text-red-500">*</span>
							</label>
							<select
								id="pedido-canal"
								className="rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
								{...register("canal")}
							>
								<option value="WHATSAPP">WhatsApp</option>
								<option value="PRESENCIAL">Presencial</option>
								<option value="INSTAGRAM">Instagram</option>
								<option value="SHOPEE">Shopee</option>
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor="pedido-prioridade" className="text-[13px] text-gray-600 font-medium">
								Prioridade
							</label>
							<select
								id="pedido-prioridade"
								className="rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
								{...register("prioridade")}
							>
								<option value="NORMAL">Normal</option>
								<option value="ALTA">Alta</option>
								<option value="URGENTE">Urgente</option>
							</select>
						</div>
					</div>
					<Input
						label="Data do pedido"
						type="date"
						{...register("data_pedido")}
					/>
				</Section>

				{/* Cliente */}
				<Section label="Cliente">
					<Input
						label="Nome"
						placeholder="Nome do cliente"
						{...register("cliente_nome")}
					/>
					<div className="grid grid-cols-2 gap-3">
						<Input
							label="Telefone"
							placeholder="(11) 99999-9999"
							type="tel"
							{...register("cliente_telefone")}
						/>
						<Input
							label="E-mail"
							placeholder="email@exemplo.com"
							type="email"
							{...register("cliente_email")}
						/>
					</div>
					<Input
						label="Referência / Como nos encontrou"
						placeholder="Ex: indicação, Instagram..."
						{...register("cliente_referencia")}
					/>
				</Section>

				{/* Itens */}
				<Section label="Itens do pedido">
					{fields.length === 0 && (
						<p className="text-xs text-gray-400 text-center py-2">
							Nenhum item adicionado.
						</p>
					)}
					{fields.map((field, idx) => (
						<ItemRow
							key={field.id}
							idx={idx}
							tipo={field.tipo}
							modelos={modelos}
							register={register}
							watchItens={watchItens}
							onModeloChange={onModeloChange}
							onRemove={() => remove(idx)}
							onCriarProduto={() => setCriarProdutoIdx(idx)}
							errors={errors}
						/>
					))}
					<div className="flex gap-2 mt-1">
						<Button
							type="button"
							variant="secondary"
							size="sm"
							onClick={() => adicionarItem("PRODUTO")}
						>
							+ Produto do catálogo
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => adicionarItem("CORINGA")}
						>
							+ Item personalizado
						</Button>
					</div>
					{errors.itens?.root?.message && (
						<p className="text-xs text-red-500">{errors.itens.root.message}</p>
					)}
					{typeof errors.itens?.message === "string" && (
						<p className="text-xs text-red-500">{errors.itens.message}</p>
					)}
				</Section>

				{/* Prazo */}
				<Section label="Prazo">
					<Input
						label="Data do prazo de entrega"
						type="date"
						{...register("data_prazo")}
					/>
				</Section>

				{/* Financeiro */}
				<Section label="Financeiro">
					<div className="grid grid-cols-2 gap-3">
						<div className="flex flex-col gap-1">
							<label htmlFor="pedido-forma-pagamento" className="text-[13px] text-gray-600 font-medium">
								Forma de pagamento
							</label>
							<select
								id="pedido-forma-pagamento"
								className="rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
								{...register("forma_pagamento")}
							>
								<option value="">— Não definido —</option>
								<option value="PIX">PIX</option>
								<option value="DINHEIRO">Dinheiro</option>
								<option value="CARTAO">Cartão</option>
								<option value="OUTRO">Outro</option>
							</select>
						</div>
						<div className="flex flex-col gap-1">
							<label htmlFor="pedido-status-pagamento" className="text-[13px] text-gray-600 font-medium">
								Status do pagamento
							</label>
							<select
								id="pedido-status-pagamento"
								className="rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
								{...register("status_pagamento")}
							>
								<option value="PENDENTE">Pendente</option>
								<option value="SINAL_RECEBIDO">Sinal recebido</option>
								<option value="PAGO">Pago</option>
							</select>
						</div>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<Input
							label="Sinal / entrada (R$)"
							placeholder="0,00"
							type="text"
							inputMode="decimal"
							{...register("valor_sinal")}
						/>
						<Input
							label="Desconto (R$)"
							placeholder="0,00"
							type="text"
							inputMode="decimal"
							{...register("desconto_valor")}
						/>
					</div>
					{fields.length > 0 && (
						<div className="rounded-lg bg-[#F4F8FD] border border-[#B5D4F4] px-4 py-3 flex flex-col gap-1 text-sm">
							<div className="flex justify-between text-gray-600">
								<span>Subtotal</span>
								<span>
									{subtotal.toLocaleString("pt-BR", {
										style: "currency",
										currency: "BRL",
									})}
								</span>
							</div>
							{desconto > 0 && (
								<div className="flex justify-between text-gray-500">
									<span>Desconto</span>
									<span>
										-{desconto.toLocaleString("pt-BR", {
											style: "currency",
											currency: "BRL",
										})}
									</span>
								</div>
							)}
							<div className="flex justify-between font-semibold text-gray-900 border-t border-[#B5D4F4] pt-1 mt-0.5">
								<span>Total</span>
								<span className="text-[#185FA5]">
									{total.toLocaleString("pt-BR", {
										style: "currency",
										currency: "BRL",
									})}
								</span>
							</div>
						</div>
					)}
				</Section>

				{/* Observação */}
				<Section label="Observação">
					<textarea
						className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5] resize-none"
						rows={2}
						placeholder="Observações gerais do pedido..."
						{...register("observacao")}
					/>
				</Section>
			</form>
		</Modal>

		<ProdutoModal
			open={criarProdutoIdx !== null}
			onClose={() => setCriarProdutoIdx(null)}
			onCreated={modeloId => {
				if (criarProdutoIdx !== null) {
					handleProdutoCriado(modeloId, criarProdutoIdx);
				}
			}}
		/>
		</>
	);
}

function Section({
	label,
	children,
}: {
	readonly label: string;
	readonly children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] border-b border-[#E6F1FB] pb-1">
				{label}
			</p>
			{children}
		</div>
	);
}

function ItemRow({
	idx,
	tipo,
	modelos,
	register,
	watchItens,
	onModeloChange,
	onRemove,
	onCriarProduto,
}: {
	readonly idx: number;
	readonly tipo: "PRODUTO" | "CORINGA";
	readonly modelos: ModeloOption[];
	readonly register: ReturnType<typeof useForm<FormValues>>["register"];
	readonly watchItens: FormValues["itens"];
	readonly onModeloChange: (idx: number, modeloId: string) => void;
	readonly onRemove: () => void;
	readonly onCriarProduto: () => void;
	readonly errors: ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
}) {
	const item = watchItens?.[idx];

	return (
		<div className="rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] p-3 flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold text-[#185FA5] uppercase tracking-wide">
					{tipo === "PRODUTO" ? "Produto do catálogo" : "Item personalizado"}
				</span>
				<button
					type="button"
					onClick={onRemove}
					className="text-xs text-red-400 hover:text-red-600"
				>
					Remover
				</button>
			</div>

			{tipo === "PRODUTO" ? (
				<div className="flex flex-col gap-1">
					<div className="flex items-center justify-between">
						<span className="text-[13px] text-gray-600 font-medium">
							Produto
						</span>
						<button
							type="button"
							onClick={onCriarProduto}
							className="text-xs text-[#185FA5] hover:underline"
						>
							+ Criar novo produto
						</button>
					</div>
					<SearchableSelect
						placeholder="— Selecionar produto —"
						searchPlaceholder="Buscar por nome ou código..."
						options={modelos.map(m => ({
							value: m.modelo_id,
							label: m.nome,
							sublabel: m.codigo,
						}))}
						value={item?.modelo_id ?? ""}
						onChange={v => onModeloChange(idx, v)}
					/>
				</div>
			) : (
				<Input
					label="Descrição"
					placeholder="Descreva o item personalizado..."
					{...register(`itens.${idx}.descricao_custom`)}
				/>
			)}

			<div className="grid grid-cols-3 gap-2">
				<Input
					label="Qtd"
					type="number"
					min={1}
					placeholder="1"
					{...register(`itens.${idx}.quantidade`)}
				/>
				<Input
					label="Preço venda (R$)"
					type="text"
					inputMode="decimal"
					placeholder="0,00"
					{...register(`itens.${idx}.preco_venda_unit`)}
				/>
				<Input
					label="Custo unit. (R$)"
					type="text"
					inputMode="decimal"
					placeholder="0,00"
					{...register(`itens.${idx}.custo_unit`)}
				/>
			</div>

			<div className="grid grid-cols-3 gap-2">
				<Input
					label="Tempo (min)"
					type="number"
					min={0}
					placeholder="—"
					{...register(`itens.${idx}.tempo_impressao_min`)}
				/>
				<Input
					label="Peso (g)"
					type="number"
					min={0}
					placeholder="—"
					{...register(`itens.${idx}.peso_g`)}
				/>
				<Input
					label="Placas"
					type="number"
					min={1}
					placeholder="—"
					{...register(`itens.${idx}.num_placas`)}
				/>
			</div>
		</div>
	);
}
