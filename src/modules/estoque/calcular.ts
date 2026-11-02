/**
 * Cálculo canônico de estoque disponível.
 *
 * Antes desta extração a fórmula existia em 5 lugares que discordavam entre si
 * — a cópia dentro de `criarEnvio` ignorava as vendas diretas e por isso
 * subestimava o déficit ao gerar produção automática. Esta é a única versão.
 *
 * Puro: recebe as linhas já carregadas do banco e devolve números.
 */

export type EstoqueStatus = "OK" | "ATENCAO" | "REPOR" | "SEM_ESTOQUE";

export type EnvioStatus = "ABERTO" | "CONFERIDO" | "ENCERRADO";

export interface ModeloEstoque {
	modelo_id: string;
	codigo?: string | null;
	nome?: string;
	estoque_minimo?: number | null;
}

export interface ProducaoEstoque {
	modelo_id: string;
	quantidade: number | null;
}

export interface EnvioItemEstoque {
	modelo_id: string;
	qtd_enviada: number | null;
	qtd_vendida: number | null;
	qtd_devolvida: number | null;
	/** Status do envio dono do item. Itens sem envio devem ser omitidos. */
	envio_status: EnvioStatus;
}

export interface VendaDiretaItemEstoque {
	modelo_id: string;
	quantidade: number | null;
}

export interface EstoqueCalculadoRow {
	modelo_id: string;
	codigo: string;
	nome: string;
	estoque_inicial: number;
	entradas: number;
	saidas: number;
	estoque_minimo: number;
	em_consignacao: number;
	disponivel: number;
	status: EstoqueStatus;
}

export interface EstoqueInput {
	modelos: ModeloEstoque[];
	producoes: ProducaoEstoque[];
	envioItens: EnvioItemEstoque[];
	vendaDiretaItens: VendaDiretaItemEstoque[];
}

/**
 * Faixas de alerta.
 *
 * `REPOR` usa `<` e não `<=`: com mínimo 10 e disponível 10 o estoque ainda
 * atende ao mínimo, então é ATENCAO, não REPOR.
 */
export function calcularStatus(
	disponivel: number,
	minimo: number
): EstoqueStatus {
	if (disponivel <= 0) return "SEM_ESTOQUE";
	if (minimo > 0 && disponivel < minimo) return "REPOR";
	if (minimo > 0 && disponivel <= minimo * 1.5) return "ATENCAO";
	return "OK";
}

const n = (v: number | null | undefined): number =>
	v != null && Number.isFinite(v) ? v : 0;

function somar(mapa: Map<string, number>, chave: string, valor: number): void {
	mapa.set(chave, (mapa.get(chave) ?? 0) + valor);
}

/**
 * Saídas e saldo em consignação a partir dos itens de envio.
 *
 * - `ABERTO`: tudo que saiu está fora do estoque e em consignação.
 * - `CONFERIDO` / `ENCERRADO`: sai `qtd_enviada - qtd_devolvida`, ou seja,
 *   só a devolução física volta ao estoque. O que continua com o revendedor
 *   segue fora, e o que ainda não foi vendido nem devolvido segue em
 *   consignação.
 */
function acumularEnvios(
	envioItens: EnvioItemEstoque[],
	saidas: Map<string, number>,
	consignacao: Map<string, number>
): void {
	for (const item of envioItens) {
		const id = item.modelo_id;
		const enviada = n(item.qtd_enviada);

		if (item.envio_status === "ABERTO") {
			somar(saidas, id, enviada);
			somar(consignacao, id, enviada);
			continue;
		}

		if (item.envio_status === "CONFERIDO" || item.envio_status === "ENCERRADO") {
			const vendida = n(item.qtd_vendida);
			const devolvida = n(item.qtd_devolvida);
			somar(saidas, id, enviada - devolvida);
			const saldo = enviada - vendida - devolvida;
			if (saldo > 0) somar(consignacao, id, saldo);
		}
	}
}

export function calcularEstoque(input: EstoqueInput): EstoqueCalculadoRow[] {
	const entradas = new Map<string, number>();
	const saidas = new Map<string, number>();
	const consignacao = new Map<string, number>();

	for (const p of input.producoes) {
		somar(entradas, p.modelo_id, n(p.quantidade));
	}

	acumularEnvios(input.envioItens, saidas, consignacao);

	for (const v of input.vendaDiretaItens) {
		somar(saidas, v.modelo_id, n(v.quantidade));
	}

	return input.modelos.map(m => {
		const id = m.modelo_id;
		const entrada = entradas.get(id) ?? 0;
		const saida = saidas.get(id) ?? 0;
		const disponivel = entrada - saida;
		const minimo = n(m.estoque_minimo);

		return {
			modelo_id: id,
			codigo: m.codigo ?? "-",
			nome: m.nome ?? "",
			estoque_inicial: 0,
			entradas: entrada,
			saidas: saida,
			estoque_minimo: minimo,
			em_consignacao: consignacao.get(id) ?? 0,
			disponivel,
			status: calcularStatus(disponivel, minimo),
		};
	});
}

/**
 * Só o disponível por modelo, para quem não precisa da linha completa
 * (ex.: validar déficit antes de criar um envio).
 */
export function calcularDisponivelPorModelo(
	input: Omit<EstoqueInput, "modelos">
): Map<string, number> {
	const entradas = new Map<string, number>();
	const saidas = new Map<string, number>();
	const consignacao = new Map<string, number>();

	for (const p of input.producoes) {
		somar(entradas, p.modelo_id, n(p.quantidade));
	}
	acumularEnvios(input.envioItens, saidas, consignacao);
	for (const v of input.vendaDiretaItens) {
		somar(saidas, v.modelo_id, n(v.quantidade));
	}

	const out = new Map<string, number>();
	for (const id of new Set([...entradas.keys(), ...saidas.keys()])) {
		out.set(id, (entradas.get(id) ?? 0) - (saidas.get(id) ?? 0));
	}
	return out;
}
