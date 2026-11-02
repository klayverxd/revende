/**
 * Links públicos por token.
 *
 * Toda página fora do login (extrato do revendedor hoje; orçamento e vitrine
 * nas fases seguintes) é endereçada por um token opaco, nunca pela chave
 * primária do registro. Isso mantém três garantias:
 *
 * 1. O identificador não é adivinhável nem enumerável.
 * 2. O acesso é revogável sem mexer no cadastro (basta trocar o token).
 * 3. A página pública nunca precisa aceitar um id de linha da URL, o que
 *    elimina a classe de bug "troco o UUID e vejo o dado de outra pessoa".
 */

/** Formato canônico de UUID, em minúsculas. */
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Valida o token vindo da URL **antes** de tocar o banco.
 *
 * Devolve o token normalizado ou `null`. Chamar o banco só depois de passar
 * por aqui evita transformar a rota pública em superfície de sondagem.
 */
export function validarToken(bruto: string | undefined | null): string | null {
	if (!bruto) return null;
	const t = bruto.trim().toLowerCase();
	return UUID_RE.test(t) ? t : null;
}

/** Monta a URL absoluta do extrato de um revendedor. */
export function urlExtrato(origem: string, token: string): string {
	return `${origem.replace(/\/$/, "")}/r/${token}`;
}

/**
 * Prefixos de rota que respondem sem sessão.
 *
 * Fonte única para o middleware — a lista solta que existia antes esquecia
 * `/r/`, e por isso o link do extrato nunca funcionou.
 */
export const ROTAS_PUBLICAS: readonly string[] = [
	"/login",
	"/register",
	"/auth/callback",
	"/r/",
];

export function ehRotaPublica(pathname: string): boolean {
	return ROTAS_PUBLICAS.some(r =>
		r.endsWith("/") ? pathname.startsWith(r) : pathname === r
	);
}
