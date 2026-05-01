export type NavItem = { href: string; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
	{
		label: "GERAL",
		items: [{ href: "/dashboard", label: "Dashboard" }],
	},
	{
		label: "CADASTROS",
		items: [
			{ href: "/revendedores", label: "Revendedores" },
			{ href: "/produtos", label: "Produtos" },
		],
	},
	{
		label: "OPERAÇÕES",
		items: [
			{ href: "/envios", label: "Envios" },
			{ href: "/conferencias", label: "Conferências" },
			{ href: "/venda-direta", label: "Venda direta" },
			{ href: "/estoque", label: "Estoque" },
		],
	},
	{
		label: "FINANCEIRO",
		items: [
			{ href: "/financeiro", label: "Financeiro" },
			{ href: "/financeiro/fluxo", label: "Fluxo de caixa" },
		],
	},
	{
		label: "CONFIG",
		items: [{ href: "/calculadora", label: "Calculadora" }],
	},
];

export const bottomNavItems = [
	{ href: "/dashboard", label: "Dashboard", icon: "home" as const },
	{ href: "/envios", label: "Envios", icon: "inbox" as const },
	{ href: "/venda-direta", label: "Venda direta", icon: "clipboard" as const },
	{ href: "/estoque", label: "Estoque", icon: "cube" as const },
	{ href: "/financeiro", label: "Financeiro", icon: "chart" as const },
];

export type BottomNavIcon = (typeof bottomNavItems)[number]["icon"];

export function getTitleFromPathname(pathname: string): string {
	const allItems = navGroups.flatMap(g => g.items);
	const match = allItems.find(
		item => pathname === item.href || pathname.startsWith(item.href + "/")
	);
	return match?.label ?? "Revendê";
}

export function isNavItemActive(pathname: string, href: string): boolean {
	if (pathname === href) return true;
	// Only match sub-paths if no sibling nav item is a more specific match
	const hasExactSibling = navGroups
		.flatMap(g => g.items)
		.some(item => item.href !== href && pathname.startsWith(item.href));
	if (hasExactSibling) return false;
	return pathname.startsWith(href + "/");
}
