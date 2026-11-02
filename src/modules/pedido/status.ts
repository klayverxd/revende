/**
 * Estados de um pedido e as colunas da esteira de produção.
 *
 * Fonte única: os arrays `as const` geram os tipos TypeScript e alimentam os
 * enums do zod na validação das actions. Mudar um estado é uma edição só, em
 * vez de manter tipo, validação e UI em sincronia à mão.
 *
 * Mora fora de `actions.ts` porque arquivos `"use server"` só podem exportar
 * funções async.
 */

/**
 * Na mesma ordem do CHECK `pedido_status_check` (migration 022). Em produção
 * a coluna é TEXT; o CHECK é o que barra valor fora desta lista, e o teste de
 * integração confere que os dois são idênticos.
 */
export const PEDIDO_STATUS = [
	"IDEIA",
	"ORCAMENTO",
	"NOVO",
	"EM_MODELAGEM",
	"AGUARDANDO_IMPRESSAO",
	"IMPRIMINDO",
	"EM_ACABAMENTO",
	"MIDIA",
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

// ─── Colunas da esteira ───────────────────────────────────────────────────

/**
 * As colunas do kanban, espelhando as que já se usavam no Trello.
 *
 * Uma coluna pode agrupar mais de um status: "A fazer" junta `NOVO` (acabou de
 * entrar) com `AGUARDANDO_IMPRESSAO` (já modelado, na fila) porque na prática
 * são a mesma pilha de trabalho. `statusAoEntrar` é o status gravado quando o
 * card é arrastado para a coluna.
 */
export interface ColunaEsteira {
	readonly id: string;
	readonly titulo: string;
	readonly statuses: readonly PedidoStatus[];
	readonly statusAoEntrar: PedidoStatus;
	/** Colunas de encerramento ficam recolhidas por padrão. */
	readonly recolhidaPorPadrao?: boolean;
}

export const COLUNAS_ESTEIRA: readonly ColunaEsteira[] = [
	{
		id: "ideias",
		titulo: "Ideias",
		statuses: ["IDEIA"],
		statusAoEntrar: "IDEIA",
	},
	{
		id: "orcamento",
		titulo: "Orçamento",
		statuses: ["ORCAMENTO"],
		statusAoEntrar: "ORCAMENTO",
	},
	{
		id: "a-fazer",
		titulo: "A fazer",
		statuses: ["NOVO", "EM_MODELAGEM", "AGUARDANDO_IMPRESSAO"],
		statusAoEntrar: "NOVO",
	},
	{
		id: "imprimindo",
		titulo: "Imprimindo",
		statuses: ["IMPRIMINDO"],
		statusAoEntrar: "IMPRIMINDO",
	},
	{
		id: "processo-manual",
		titulo: "Processo manual",
		statuses: ["EM_ACABAMENTO"],
		statusAoEntrar: "EM_ACABAMENTO",
	},
	{
		id: "midia",
		titulo: "Mídia",
		statuses: ["MIDIA"],
		statusAoEntrar: "MIDIA",
	},
	{
		id: "a-entregar",
		titulo: "A entregar",
		statuses: ["PRONTO", "ENVIADO"],
		statusAoEntrar: "PRONTO",
	},
	{
		id: "concluidos",
		titulo: "Concluídos",
		statuses: ["ENTREGUE"],
		statusAoEntrar: "ENTREGUE",
		recolhidaPorPadrao: true,
	},
	{
		id: "cancelados",
		titulo: "Cancelados",
		statuses: ["CANCELADO"],
		statusAoEntrar: "CANCELADO",
		recolhidaPorPadrao: true,
	},
];

/**
 * Rótulos, cores e variantes por status.
 *
 * Estavam duplicados em `PedidosList.tsx` e `PedidoDetalhe.tsx` — e os dois
 * discordavam ("Em acabamento" vs "Processo manual"). Uma tabela só, aqui.
 */
export const STATUS_LABEL: Record<PedidoStatus, string> = {
	IDEIA: "Ideia",
	ORCAMENTO: "Orçamento",
	NOVO: "Novo",
	EM_MODELAGEM: "Em modelagem",
	AGUARDANDO_IMPRESSAO: "Ag. impressão",
	IMPRIMINDO: "Imprimindo",
	EM_ACABAMENTO: "Processo manual",
	MIDIA: "Mídia",
	PRONTO: "Pronto",
	ENVIADO: "Enviado",
	ENTREGUE: "Entregue",
	CANCELADO: "Cancelado",
};

/** Variante do componente `Badge`. */
export type StatusVariante =
	| "neutral"
	| "success"
	| "warning"
	| "danger"
	| "info";

export const STATUS_VARIANTE: Record<PedidoStatus, StatusVariante> = {
	IDEIA: "neutral",
	ORCAMENTO: "neutral",
	NOVO: "info",
	EM_MODELAGEM: "neutral",
	AGUARDANDO_IMPRESSAO: "warning",
	IMPRIMINDO: "warning",
	EM_ACABAMENTO: "warning",
	MIDIA: "warning",
	PRONTO: "success",
	ENVIADO: "info",
	ENTREGUE: "success",
	CANCELADO: "danger",
};

/** Classes Tailwind para o chip de status nas tabelas. */
export const STATUS_COR: Record<PedidoStatus, string> = {
	IDEIA: "bg-slate-50 text-slate-600 border-slate-200",
	ORCAMENTO: "bg-violet-50 text-violet-700 border-violet-200",
	NOVO: "bg-blue-50 text-blue-700 border-blue-200",
	EM_MODELAGEM: "bg-gray-100 text-gray-700 border-gray-200",
	AGUARDANDO_IMPRESSAO: "bg-amber-50 text-amber-700 border-amber-200",
	IMPRIMINDO: "bg-orange-50 text-orange-700 border-orange-200",
	EM_ACABAMENTO: "bg-yellow-50 text-yellow-700 border-yellow-200",
	MIDIA: "bg-pink-50 text-pink-700 border-pink-200",
	PRONTO: "bg-teal-50 text-teal-700 border-teal-200",
	ENVIADO: "bg-indigo-50 text-indigo-700 border-indigo-200",
	ENTREGUE: "bg-green-50 text-green-700 border-green-200",
	CANCELADO: "bg-red-50 text-red-700 border-red-200",
};

/**
 * Ordem de avanço natural do pedido, sem os terminais.
 * Usada pelos seletores de "próximo passo".
 */
export const STATUS_ORDEM: readonly PedidoStatus[] = PEDIDO_STATUS.filter(
	s => s !== "CANCELADO"
);

const COLUNA_POR_STATUS = new Map<PedidoStatus, ColunaEsteira>(
	COLUNAS_ESTEIRA.flatMap(c => c.statuses.map(s => [s, c] as const))
);

/** Em qual coluna do kanban este status aparece. */
export function colunaDoStatus(status: PedidoStatus): ColunaEsteira {
	const c = COLUNA_POR_STATUS.get(status);
	if (!c) {
		// Só acontece se um status novo entrar no enum sem entrar em nenhuma
		// coluna — o teste unitário cobre exatamente isso.
		throw new Error(`Status sem coluna na esteira: ${status}`);
	}
	return c;
}

export function colunaPorId(id: string): ColunaEsteira | undefined {
	return COLUNAS_ESTEIRA.find(c => c.id === id);
}

/**
 * Status a gravar quando o card é solto numa coluna.
 *
 * Se o status atual já pertence à coluna de destino, ele é PRESERVADO — soltar
 * um card de `AGUARDANDO_IMPRESSAO` na própria coluna "A fazer" não deve
 * rebaixá-lo para `NOVO`.
 */
export function statusAoMover(
	statusAtual: PedidoStatus,
	colunaDestinoId: string
): PedidoStatus | null {
	const destino = colunaPorId(colunaDestinoId);
	if (!destino) return null;
	if (destino.statuses.includes(statusAtual)) return statusAtual;
	return destino.statusAoEntrar;
}

// ─── Ciclo de vida ────────────────────────────────────────────────────────

/** Estados em que o pedido não está mais em andamento. */
export const STATUS_FINAIS: readonly PedidoStatus[] = ["ENTREGUE", "CANCELADO"];

export function pedidoEstaAtivo(status: PedidoStatus): boolean {
	return !STATUS_FINAIS.includes(status);
}

/**
 * Estados anteriores ao compromisso: ainda não é um pedido de verdade, é uma
 * anotação ou uma proposta. Não entram em faturamento nem em previsão.
 */
export const STATUS_PRE_PEDIDO: readonly PedidoStatus[] = ["IDEIA", "ORCAMENTO"];

export function ehPrePedido(status: PedidoStatus): boolean {
	return STATUS_PRE_PEDIDO.includes(status);
}

/** Está em produção agora — usado pela tela "Hoje" e pela capacidade. */
export const STATUS_EM_PRODUCAO: readonly PedidoStatus[] = [
	"NOVO",
	"EM_MODELAGEM",
	"AGUARDANDO_IMPRESSAO",
	"IMPRIMINDO",
	"EM_ACABAMENTO",
	"MIDIA",
];

/** Pronto, esperando sair. */
export const STATUS_A_ENTREGAR: readonly PedidoStatus[] = ["PRONTO", "ENVIADO"];

// ─── Prazo ────────────────────────────────────────────────────────────────

export type SituacaoPrazo = "SEM_PRAZO" | "CUMPRIDO" | "ATRASADO" | "HOJE" | "FUTURO";

/**
 * Semáforo do prazo no card.
 *
 * Compara datas `YYYY-MM-DD` como string, sem construir `Date` — é o que evita
 * o deslocamento de um dia por fuso que existia nas telas antigas.
 */
export function situacaoPrazo(
	dataPrazo: string | null | undefined,
	hoje: string,
	{ prazoConcluido = false, status }: {
		prazoConcluido?: boolean;
		status?: PedidoStatus;
	} = {}
): SituacaoPrazo {
	if (prazoConcluido) return "CUMPRIDO";
	if (status && STATUS_FINAIS.includes(status)) return "CUMPRIDO";
	if (!dataPrazo) return "SEM_PRAZO";

	const prazo = dataPrazo.slice(0, 10);
	if (prazo < hoje) return "ATRASADO";
	if (prazo === hoje) return "HOJE";
	return "FUTURO";
}

// ─── Ordenação na coluna ──────────────────────────────────────────────────

/**
 * Nova posição para um card solto entre `anterior` e `posterior`.
 *
 * O ponto médio evita renumerar a coluna a cada arrasto — é por isso que
 * `pedido.ordem_esteira` é DOUBLE PRECISION e não INTEGER.
 */
export function ordemEntre(
	anterior: number | null | undefined,
	posterior: number | null | undefined
): number {
	if (anterior == null && posterior == null) return 0;
	if (anterior == null) return posterior! - 1;
	if (posterior == null) return anterior + 1;
	return (anterior + posterior) / 2;
}
