/**
 * Primitivas de validação para Server Actions.
 *
 * O projeto já tinha zod, mas usado **só no cliente**, em 5 modais — as 15
 * `actions.ts` aceitavam qualquer objeto que chegasse. Server Action é
 * endpoint HTTP: a validação do formulário no navegador não protege nada.
 *
 * Cada action define seu próprio schema com estas peças, e chama `validar()`
 * na primeira linha.
 */
import { z } from "zod";

/** UUID — todo id do sistema. */
export const zUuid = z.uuid("Identificador inválido");

/** Data no formato `YYYY-MM-DD`, que é como as colunas DATE são escritas. */
export const zDataISO = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");

/** Quantidade de peças: inteiro positivo. */
export const zQuantidade = z
	.number()
	.int("Quantidade deve ser um número inteiro")
	.positive("Quantidade deve ser maior que zero")
	.max(1_000_000, "Quantidade fora da faixa aceitável");

/** Quantidade que pode ser zero (contagem de conferência, devolução). */
export const zQuantidadeZero = z
	.number()
	.int("Quantidade deve ser um número inteiro")
	.min(0, "Quantidade não pode ser negativa")
	.max(1_000_000, "Quantidade fora da faixa aceitável");

/** Valor monetário: não negativo e com teto sanitário. */
export const zValor = z
	.number()
	.min(0, "Valor não pode ser negativo")
	.max(10_000_000, "Valor fora da faixa aceitável");

/** Percentual em pontos (0 a 100). */
export const zPercentual = z
	.number()
	.min(0, "Percentual não pode ser negativo")
	.max(100, "Percentual não pode passar de 100");

/** Texto livre opcional, com limite para não virar vetor de abuso. */
export const zTextoOpcional = (max = 2000) =>
	z
		.string()
		.trim()
		.max(max, `Texto muito longo (máximo ${max})`)
		.optional()
		.nullable();

/**
 * Como `zTextoOpcional`, mas normaliza `null` e string vazia para `undefined`.
 *
 * Use quando o parâmetro da action é `string | undefined` — evita ter que
 * afrouxar a assinatura só para acomodar o `null` que o schema aceitaria.
 */
export const zTextoOmitivel = (max = 2000) =>
	zTextoOpcional(max).transform(v => (v ? v : undefined));

/** Texto obrigatório e não vazio. */
export const zTexto = (max = 200) =>
	z
		.string()
		.trim()
		.min(1, "Campo obrigatório")
		.max(max, `Texto muito longo (máximo ${max})`);

/**
 * Roda o schema e lança `Error` com mensagem legível quando falha.
 *
 * As telas já capturam `Error` e mostram no toast, então a mensagem chega ao
 * usuário — em vez do erro cru do Postgres que aparecia quando um payload
 * inválido passava direto para o banco.
 */
export function validar<T extends z.ZodType>(
	schema: T,
	valor: unknown,
	contexto?: string
): z.output<T> {
	const r = schema.safeParse(valor);
	if (r.success) return r.data;

	const detalhe = r.error.issues
		.slice(0, 3)
		.map(i => {
			const caminho = i.path.filter(p => typeof p !== "symbol").join(".");
			return caminho ? `${caminho}: ${i.message}` : i.message;
		})
		.join("; ");

	throw new Error(contexto ? `${contexto} — ${detalhe}` : detalhe);
}
