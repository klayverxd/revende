/**
 * Quando um envio está encerrado.
 *
 * Esta checagem existia em 4 cópias — conferência, devolução, baixa individual
 * de estoque e recebimento — que podiam discordar entre si e deixar um envio
 * preso em `CONFERIDO` para sempre. Aqui ela é uma só.
 *
 * Puro: nada de Supabase.
 */

export type EnvioStatus = "ABERTO" | "CONFERIDO" | "ENCERRADO";

export interface ItemFechamento {
	qtd_enviada: number | null;
	qtd_vendida: number | null;
	qtd_devolvida: number | null;
}

const n = (v: number | null | undefined): number =>
	v != null && Number.isFinite(v) ? v : 0;

/** Unidades deste item que ainda estão fisicamente com o revendedor. */
export function qtdComRevendedor(item: ItemFechamento): number {
	return Math.max(
		0,
		n(item.qtd_enviada) - n(item.qtd_vendida) - n(item.qtd_devolvida)
	);
}

/** Total de unidades do envio ainda em posse do revendedor. */
export function totalComRevendedor(itens: ItemFechamento[]): number {
	return itens.reduce((soma, i) => soma + qtdComRevendedor(i), 0);
}

/**
 * Verdadeiro quando nada mais está com o revendedor — tudo foi vendido ou
 * devolvido. Envio vazio conta como encerrado.
 */
export function envioEstaEncerrado(itens: ItemFechamento[]): boolean {
	return itens.every(i => qtdComRevendedor(i) === 0);
}

/**
 * Status resultante de uma conferência: volta a `ABERTO` enquanto sobrar
 * mercadoria com o revendedor, vira `CONFERIDO` quando não sobra nada.
 *
 * O passo para `ENCERRADO` é do financeiro, quando o acerto é recebido.
 */
export function statusAposConferencia(itens: ItemFechamento[]): EnvioStatus {
	return envioEstaEncerrado(itens) ? "CONFERIDO" : "ABERTO";
}

/**
 * Status resultante do recebimento do acerto: só encerra de fato se não
 * houver mais mercadoria pendente com o revendedor.
 */
export function statusAposRecebimento(itens: ItemFechamento[]): EnvioStatus {
	return envioEstaEncerrado(itens) ? "ENCERRADO" : "CONFERIDO";
}
