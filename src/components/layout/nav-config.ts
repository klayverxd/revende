/**
 * Navegação — fonte única.
 *
 * Organizada por **módulo**, não por tabela. A Calculadora saiu de "CONFIG",
 * onde estava escondida ao lado de "Configurações", e virou módulo de primeira
 * classe: é a ferramenta que abre todo o fluxo de trabalho.
 */

export const APP_NOME = "Imprimimos";

export type NavItem = {
	href: string;
	label: string;
	/** Descrição curta para a busca global (Ctrl+K). */
	descricao?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
	{
		label: "TRABALHO",
		items: [
			{ href: "/hoje", label: "Hoje", descricao: "O que fazer agora" },
			{
				href: "/producao",
				label: "Produção",
				descricao: "Esteira de pedidos em kanban",
			},
		],
	},
	{
		label: "CATÁLOGO",
		items: [
			{
				href: "/produtos",
				label: "Produtos",
				descricao: "Catálogo por categoria",
			},
			{
				href: "/calculadora",
				label: "Calculadora",
				descricao: "Custo de impressão e preço de venda",
			},
			{ href: "/estoque", label: "Estoque", descricao: "Peças prontas" },
		],
	},
	{
		label: "CONSIGNADO",
		items: [
			{ href: "/revendedores", label: "Revendedores" },
			{ href: "/envios", label: "Envios", descricao: "Mercadoria em consignação" },
			{ href: "/conferencias", label: "Conferências", descricao: "Acertos a fechar" },
		],
	},
	{
		label: "FINANCEIRO",
		items: [
			{ href: "/financeiro", label: "Financeiro" },
			{
				href: "/venda-direta",
				label: "Venda direta",
				descricao: "Vendas fora da esteira",
			},
		],
	},
	{
		label: "CONFIG",
		items: [{ href: "/configuracoes", label: "Configurações" }],
	},
];

export const bottomNavItems = [
	{ href: "/hoje", label: "Hoje", icon: "home" as const },
	{ href: "/producao", label: "Produção", icon: "clipboard" as const },
	{ href: "/produtos", label: "Produtos", icon: "cube" as const },
	{ href: "/conferencias", label: "Conferir", icon: "inbox" as const },
	{ href: "/financeiro", label: "Financeiro", icon: "chart" as const },
];

export type BottomNavIcon = (typeof bottomNavItems)[number]["icon"];

/** Todos os itens, achatados — usado pela busca global. */
export const todosNavItems: NavItem[] = navGroups.flatMap(g => g.items);

export function getTitleFromPathname(pathname: string): string {
	// Mais específico primeiro: "/produtos/x/precos" deve casar com o item mais
	// longo que for prefixo, não com o primeiro da lista.
	const match = [...todosNavItems]
		.sort((a, b) => b.href.length - a.href.length)
		.find(
			item => pathname === item.href || pathname.startsWith(`${item.href}/`)
		);
	return match?.label ?? APP_NOME;
}

export function isNavItemActive(pathname: string, href: string): boolean {
	if (pathname === href) return true;
	// Só marca sub-rota se nenhum irmão for um casamento mais específico —
	// senão "/financeiro" acenderia junto com "/financeiro/fluxo".
	const irmaoMaisEspecifico = todosNavItems.some(
		item =>
			item.href !== href &&
			item.href.length > href.length &&
			(pathname === item.href || pathname.startsWith(`${item.href}/`))
	);
	if (irmaoMaisEspecifico) return false;
	return pathname.startsWith(`${href}/`);
}
