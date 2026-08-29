/**
 * Estados de um pedido.
 *
 * Fonte única: o array `as const` gera o tipo TypeScript e alimenta o enum do
 * zod na validação da action. Acrescentar um estado — as colunas da esteira
 * (IDEIA, ORCAMENTO, MIDIA) na Fase 1 — passa a exigir uma única edição, em
 * vez de manter tipo e validação em sincronia à mão.
 *
 * Mora fora de `actions.ts` porque arquivos `"use server"` só podem exportar
 * funções async.
 */

export const PEDIDO_STATUS = [
	"NOVO",
	"EM_MODELAGEM",
	"AGUARDANDO_IMPRESSAO",
	"IMPRIMINDO",
	"EM_ACABAMENTO",
	"PRONTO",
	"ENVIADO",
	"ENTREGUE",
	"CANCELADO",
] as const;

export type PedidoStatus = (typeof PEDIDO_STATUS)[number];

export const CANAL_PEDIDO = [
	"PRESENCIAL",
	"WHATSAPP",
	"INSTAGRAM",
	"SHOPEE",
] as const;

export type CanalPedido = (typeof CANAL_PEDIDO)[number];

export const STATUS_PAGAMENTO = ["PENDENTE", "SINAL_RECEBIDO", "PAGO"] as const;

export type StatusPagamento = (typeof STATUS_PAGAMENTO)[number];

export const PRIORIDADE = ["NORMAL", "ALTA", "URGENTE"] as const;

export type Prioridade = (typeof PRIORIDADE)[number];

export const FORMA_PAGAMENTO = ["PIX", "DINHEIRO", "CARTAO", "OUTRO"] as const;

export type FormaPagamento = (typeof FORMA_PAGAMENTO)[number];

export const ITEM_TIPO = ["PRODUTO", "CORINGA"] as const;

export type ItemTipo = (typeof ITEM_TIPO)[number];

/** Estados em que o pedido não está mais em andamento. */
export const STATUS_FINAIS: readonly PedidoStatus[] = ["ENTREGUE", "CANCELADO"];

export function pedidoEstaAtivo(status: PedidoStatus): boolean {
	return !STATUS_FINAIS.includes(status);
}
