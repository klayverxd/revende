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

import {
	PEDIDO_STATUS,
	type PedidoStatus,
} from "@/modules/pedido/status";

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

const CANAL_TAXA_DEFAULT: Record<string, { pct: number; fixo: number }> = {
	SHOPEE:     { pct: 20, fixo: 4 },
	PRESENCIAL: { pct: 0,  fixo: 0 },
	WHATSAPP:   { pct: 0,  fixo: 0 },
	INSTAGRAM:  { pct: 0,  fixo: 0 },
};

const schema = z.object({
	canal: z.enum(["PRESENCIAL", "WHATSAPP", "INSTAGRAM", "SHOPEE"]),
	status: z.enum(PEDIDO_STATUS),
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
	taxa_marketplace_pct: z.string().optional(),
	custo_envio: z.string().optional(),
	outros_encargos: z.string().optional(),
	observacao: z.string().optional(),
	itens: z.array(itemSchema).min(1, "Adicione ao menos um item"),
});

type FormValues = z.infer<typeof schema>;

const hoje = new Date().toISOString().slice(0, 10);

export interface PedidoParaEditar {
	pedido_id: string;
	numero_pedido: string;
	canal: CanalPedido;
	status: PedidoStatus;
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
	taxa_marketplace_pct: number | null;
	custo_envio: number | null;
	outros_encargos: number | null;
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
			status: "NOVO" as const,
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
	const watchCanal = useWatch({ control, name: "canal" });
	const watchTaxaPct = useWatch({ control, name: "taxa_marketplace_pct" });
	const watchCustoEnvio = useWatch({ control, name: "custo_envio" });
	const watchOutrosEncargos = useWatch({ control, name: "outros_encargos" });

	function recarregarModelos() {
		return buscarModelos().then(setModelos);
	}

	useEffect(() => {
		recarregarModelos();
	}, []);

	useEffect(() => {
		if (isEdit) return;
		const defaults = CANAL_TAXA_DEFAULT[watchCanal] ?? { pct: 0, fixo: 0 };
		setValue("taxa_marketplace_pct", defaults.pct > 0 ? String(defaults.pct) : "");
		setValue("outros_encargos", defaults.fixo > 0 ? String(defaults.fixo) : "");
	}, [watchCanal, isEdit, setValue]);

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
				status: pedido.status,
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
				taxa_marketplace_pct: numStr(pedido.taxa_marketplace_pct),
				custo_envio: numStr(pedido.custo_envio),
				outros_encargos: numStr(pedido.outros_encargos),
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
				status: "NOVO",
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

	const custoProducao = (watchItens ?? []).reduce((acc, item) => {
		const custo = parseNum(item?.custo_unit) ?? 0;
		const qty = parseInt2(item?.quantidade) ?? 0;
		return acc + custo * qty;
	}, 0);
	const taxaPct = parseNum(watchTaxaPct) ?? 0;
	const taxaMarketplace = (total * taxaPct) / 100;
	const custoEnvioVal = parseNum(watchCustoEnvio) ?? 0;
	const outrosEncargosVal = parseNum(watchOutrosEncargos) ?? 0;
	const totalCustos = custoProducao + taxaMarketplace + custoEnvioVal + outrosEncargosVal;
	const lucro = total - totalCustos;
	const hasCosts = custoProducao > 0 || taxaMarketplace > 0 || custoEnvioVal > 0 || outrosEncargosVal > 0;

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
				status: values.status,
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
				taxa_marketplace_pct: parseNum(values.taxa_marketplace_pct),
				custo_envio: parseNum(values.custo_envio),
				outros_encargos: parseNum(values.outros_encargos),
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
					<div className="flex flex-col gap-1">
						<label htmlFor="pedido-status" className="text-[13px] text-gray-600 font-medium">
							Status
						</label>
						<select
							id="pedido-status"
							className="rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
							{...register("status")}
						>
							<option value="NOVO">Novo</option>
							<option value="EM_MODELAGEM">Em modelagem</option>
							<option value="AGUARDANDO_IMPRESSAO">Ag. impressão</option>
							<option value="IMPRIMINDO">Imprimindo</option>
							<option value="EM_ACABAMENTO">Em acabamento</option>
							<option value="PRONTO">Pronto</option>
							<option value="ENVIADO">Enviado</option>
							<option value="ENTREGUE">Entregue</option>
							<option value="CANCELADO">Cancelado</option>
						</select>
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

					<p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-1">
						Custos operacionais
					</p>
					<div className="grid grid-cols-3 gap-3">
						<Input
							label={`Taxa marketplace${taxaPct > 0 ? ` (${taxaPct}%)` : " (%)"}`}
							placeholder="0"
							type="text"
							inputMode="decimal"
							{...register("taxa_marketplace_pct")}
						/>
						<Input
							label="Custo de envio (R$)"
							placeholder="0,00"
							type="text"
							inputMode="decimal"
							{...register("custo_envio")}
						/>
						<Input
							label="Outros encargos (R$)"
							placeholder="0,00"
							type="text"
							inputMode="decimal"
							{...register("outros_encargos")}
						/>
					</div>

					{fields.length > 0 && (
						<div className="rounded-lg bg-[#F4F8FD] border border-[#B5D4F4] px-4 py-3 flex flex-col gap-0.5 text-sm">
							{/* Itens */}
							{(watchItens ?? []).map((item, idx) => {
								const qty = parseInt2(item?.quantidade) ?? 0;
								const preco = parseNum(item?.preco_venda_unit) ?? 0;
								const custo = parseNum(item?.custo_unit) ?? 0;
								const sub = preco * qty;
								const nome = item?.tipo === "PRODUTO"
									? (modelos.find(m => m.modelo_id === item?.modelo_id)?.nome?.toUpperCase() ?? `Item ${idx + 1}`)
									: (item?.descricao_custom || `Item ${idx + 1}`);
								return (
									<div key={fields[idx]?.id} className="flex justify-between text-gray-600 gap-2">
										<span className="truncate text-xs">{nome} {qty > 1 ? `×${qty}` : ""}{custo > 0 ? <span className="text-gray-400 ml-1">(custo: {(custo * qty).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span> : null}</span>
										<span className="shrink-0">{sub.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
									</div>
								);
							})}

							{/* Divisor + subtotal */}
							<div className="flex justify-between text-gray-700 border-t border-[#B5D4F4] pt-1 mt-1">
								<span>Subtotal</span>
								<span>{subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
							</div>
							{desconto > 0 && (
								<div className="flex justify-between text-gray-500">
									<span>Desconto</span>
									<span>−{desconto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
								</div>
							)}

							{/* Total receita */}
							<div className="flex justify-between font-semibold text-gray-900 border-t border-[#B5D4F4] pt-1 mt-0.5">
								<span>Total</span>
								<span className="text-[#185FA5]">{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
							</div>

							{/* Custos */}
							{hasCosts && (
								<>
									<p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-2 mb-0.5">Custos</p>
									{custoProducao > 0 && (
										<div className="flex justify-between text-gray-500">
											<span>Produção</span>
											<span>−{custoProducao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
										</div>
									)}
									{taxaMarketplace > 0 && (
										<div className="flex justify-between text-gray-500">
											<span>Taxa marketplace ({taxaPct}%)</span>
											<span>−{taxaMarketplace.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
										</div>
									)}
									{custoEnvioVal > 0 && (
										<div className="flex justify-between text-gray-500">
											<span>Custo de envio</span>
											<span>−{custoEnvioVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
										</div>
									)}
									{outrosEncargosVal > 0 && (
										<div className="flex justify-between text-gray-500">
											<span>Outros encargos</span>
											<span>−{outrosEncargosVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
										</div>
									)}
									<div className="flex justify-between text-gray-500 border-t border-[#B5D4F4] pt-1 mt-0.5">
										<span>Total custos</span>
										<span>−{totalCustos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
									</div>
									<div className={`flex justify-between font-semibold border-t border-[#B5D4F4] pt-1 mt-0.5 ${lucro >= 0 ? "text-green-700" : "text-red-600"}`}>
										<span>Lucro estimado</span>
										<span>{lucro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
									</div>
								</>
							)}
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
							label: m.nome.toUpperCase(),
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
