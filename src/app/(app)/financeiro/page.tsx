import { Suspense } from "react";
import {
	buscarFinanceiroGeral,
	buscarFinanceiroPedidos,
	buscarFinanceiroComissao,
} from "./actions";
import FinanceiroTabNav from "./FinanceiroTabNav";
import GeralTab from "./GeralTab";
import PedidosTab from "./PedidosTab";
import ComissaoTab from "./ComissaoTab";

type Tab = "geral" | "pedidos" | "comissao";

interface SearchParams {
	tab?: string;
	ano?: string;
	mes?: string;
}

export default async function FinanceiroPage({
	searchParams,
}: {
	readonly searchParams: Promise<SearchParams>;
}) {
	const sp = await searchParams;
	const tab = (sp.tab ?? "geral") as Tab;
	const now = new Date();
	const ano = Number.parseInt(sp.ano ?? "", 10) || now.getFullYear();
	const mes = Number.parseInt(sp.mes ?? "", 10) || now.getMonth() + 1;

	let content: React.ReactNode;
	if (tab === "pedidos") {
		const data = await buscarFinanceiroPedidos(ano, mes);
		content = <PedidosTab data={data} />;
	} else if (tab === "comissao") {
		const { pendentes, historico } = await buscarFinanceiroComissao();
		content = <ComissaoTab pendentes={pendentes} historico={historico} />;
	} else {
		const data = await buscarFinanceiroGeral(ano, mes);
		content = <GeralTab data={data} />;
	}

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h1 className="text-xl font-semibold text-gray-900">Financeiro</h1>
				<p className="text-sm text-gray-500 mt-0.5">
					Visão consolidada de receitas, custos e comissões.
				</p>
			</div>

			<Suspense>
				<FinanceiroTabNav activeTab={tab} ano={ano} mes={mes} />
			</Suspense>

			{content}
		</div>
	);
}
