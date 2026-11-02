/**
 * Falha de query vira erro de verdade — nunca lista vazia.
 *
 * O padrão `const { data } = await supabase...` descarta o `error`, e a tela
 * trata "a query falhou" como "não há registros". Foi o que aconteceu com a
 * esteira rodando contra um banco sem a migration 023: a página carregou
 * vazia, com 200, dizendo "nada em andamento" — quando na verdade havia
 * pedidos e a coluna `ordem_esteira` não existia.
 *
 * Com esta checagem a falha sobe para o `error.tsx` da rota, e em
 * desenvolvimento a mensagem já diz o que fazer.
 */

interface ErroSupabase {
	message: string;
	code?: string;
}

/**
 * Códigos que significam "o código espera algo que o banco não tem":
 * coluna ou tabela inexistente, no PostgreSQL ou no cache do PostgREST.
 */
const SCHEMA_DESATUALIZADO = new Set([
	"42703", // undefined_column
	"42P01", // undefined_table
	"PGRST204", // coluna não encontrada no schema cache
	"PGRST205", // tabela não encontrada no schema cache
]);

export function exigirSemErro(
	error: ErroSupabase | null | undefined,
	contexto: string
): void {
	if (!error) return;

	const dica = SCHEMA_DESATUALIZADO.has(error.code ?? "")
		? " — o banco está sem alguma migration que este código usa. Veja as " +
			"pendentes em CLAUDE.md, seção \"Estado da produção\"."
		: "";

	throw new Error(`${contexto}: ${error.message}${dica}`);
}
