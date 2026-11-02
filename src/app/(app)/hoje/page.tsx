import Link from "next/link";
import { buscarPainelHoje } from "@/lib/queries/hoje";
import { fmtBRL, fmtData } from "@/lib/format";
import { STATUS_LABEL } from "@/modules/pedido/status";
import type { CardEsteira } from "@/lib/queries/esteira";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "Hoje · Imprimimos" };

/**
 * "Hoje" — o que fazer agora.
 *
 * Substitui a varredura mental que se fazia no Trello: em vez de abrir cinco
 * telas e cruzar de cabeça, uma lista só, ordenada por urgência. Tudo aqui é
 * derivado; nenhuma tabela nova.
 */
export default async function HojePage() {
	const painel = await buscarPainelHoje();

	return (
		<div className="flex flex-col gap-6 max-w-4xl">
			<PageHeader title="Hoje" />

			<div>
				<h1 className="text-xl font-semibold text-gray-900">Hoje</h1>
				<p className="text-sm text-gray-600 mt-0.5">
					{fmtData(painel.hoje)} — o que precisa da sua atenção.
				</p>
			</div>

			{painel.tudoEmDia && (
				<div className="rounded-xl border border-green-200 bg-sucesso-fundo px-4 py-6 text-center">
					<p className="text-sm font-medium text-sucesso">
						Nada pendente. Nenhum atraso, nenhuma conferência vencida, estoque
						em ordem.
					</p>
					<Link
						href="/producao"
						className="text-xs text-marca-600 hover:text-marca-700 underline mt-2 inline-block"
					>
						Abrir a esteira
					</Link>
				</div>
			)}

			<Secao
				titulo="Atrasados"
				descricao="O prazo já passou e o pedido não foi concluído."
				cards={painel.atrasados}
				tom="perigo"
			/>

			<Secao
				titulo="Para hoje"
				descricao="Prazo é hoje."
				cards={painel.paraHoje}
				tom="atencao"
			/>

			<Secao
				titulo="A imprimir"
				descricao="Na fila de produção, do prazo mais curto ao mais longo."
				cards={painel.aImprimir}
			/>

			<Secao
				titulo="Acabamento e mídia"
				descricao="Impresso, falta o trabalho manual ou a foto."
				cards={painel.acabamento}
			/>

			<Secao
				titulo="A entregar"
				descricao="Pronto, esperando sair."
				cards={painel.aEntregar}
			/>

			{painel.enviosVencidos.length > 0 && (
				<section className="flex flex-col gap-2">
					<Cabecalho
						titulo="Conferências vencidas"
						descricao="Consignação aberta há mais de três semanas — vale conferir com o revendedor."
						contagem={painel.enviosVencidos.length}
						tom="atencao"
					/>
					<ul className="flex flex-col divide-y divide-marca-100 rounded-xl border border-marca-200 bg-white">
						{painel.enviosVencidos.map(e => (
							<li key={e.envio_id}>
								<Link
									href={`/conferencias/revendedor/${e.revendedor_id}`}
									className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-marca-50 transition-colors"
								>
									<div className="min-w-0">
										<p className="text-sm font-medium text-gray-900 truncate">
											{e.revendedor_nome}
										</p>
										<p className="text-xs text-gray-500">
											{e.unidades}{" "}
											{e.unidades === 1 ? "unidade" : "unidades"} desde{" "}
											{fmtData(e.data_envio)}
										</p>
									</div>
									<span className="text-xs font-medium text-atencao shrink-0 tabular-nums">
										{e.dias} dias
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}

			{painel.estoqueCritico.length > 0 && (
				<section className="flex flex-col gap-2">
					<Cabecalho
						titulo="Estoque crítico"
						descricao="Zerado ou abaixo do mínimo."
						contagem={painel.estoqueCritico.length}
						tom="atencao"
					/>
					<ul className="flex flex-col divide-y divide-marca-100 rounded-xl border border-marca-200 bg-white">
						{painel.estoqueCritico.map(p => (
							<li
								key={p.modelo_id}
								className="flex items-center justify-between gap-3 px-3 py-2.5"
							>
								<div className="min-w-0">
									<p className="text-sm font-medium text-gray-900 truncate">
										{p.nome}
									</p>
									<p className="text-xs text-gray-500">
										{p.em_consignacao > 0
											? `${p.em_consignacao} em consignação`
											: p.codigo}
									</p>
								</div>
								<span
									className={`text-xs font-semibold shrink-0 tabular-nums ${
										p.status === "SEM_ESTOQUE" ? "text-perigo" : "text-atencao"
									}`}
								>
									{p.disponivel} un
									{p.estoque_minimo > 0 && (
										<span className="font-normal text-gray-400">
											{" "}
											/ mín {p.estoque_minimo}
										</span>
									)}
								</span>
							</li>
						))}
					</ul>
					<Link
						href="/estoque"
						className="text-xs text-marca-500 hover:text-marca-700 self-start"
					>
						Ver estoque completo →
					</Link>
				</section>
			)}
		</div>
	);
}

type Tom = "perigo" | "atencao" | "neutro";

function Cabecalho({
	titulo,
	descricao,
	contagem,
	tom = "neutro",
}: {
	readonly titulo: string;
	readonly descricao: string;
	readonly contagem: number;
	readonly tom?: Tom;
}) {
	const cor =
		tom === "perigo"
			? "text-perigo"
			: tom === "atencao"
				? "text-atencao"
				: "text-gray-900";
	return (
		<div>
			<h2 className={`text-sm font-semibold ${cor}`}>
				{titulo}
				<span className="ml-1.5 text-xs font-normal text-gray-400 tabular-nums">
					{contagem}
				</span>
			</h2>
			<p className="text-xs text-gray-500 mt-0.5">{descricao}</p>
		</div>
	);
}

function Secao({
	titulo,
	descricao,
	cards,
	tom = "neutro",
}: {
	readonly titulo: string;
	readonly descricao: string;
	readonly cards: CardEsteira[];
	readonly tom?: Tom;
}) {
	// Seção vazia não aparece: a tela é sobre o que falta fazer.
	if (cards.length === 0) return null;

	const borda =
		tom === "perigo"
			? "border-red-200"
			: tom === "atencao"
				? "border-amber-200"
				: "border-marca-200";

	return (
		<section className="flex flex-col gap-2">
			<Cabecalho
				titulo={titulo}
				descricao={descricao}
				contagem={cards.length}
				tom={tom}
			/>
			<ul
				className={`flex flex-col divide-y divide-marca-100 rounded-xl border bg-white ${borda}`}
			>
				{cards.map(c => (
					<li key={c.pedido_id}>
						<Link
							href={`/producao/${c.pedido_id}`}
							className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-marca-50 transition-colors"
						>
							<div className="min-w-0">
								<div className="flex items-center gap-1.5">
									{c.prioridade !== "NORMAL" && (
										<span
											title={c.prioridade === "URGENTE" ? "Urgente" : "Alta"}
											className={`h-1.5 w-1.5 shrink-0 rounded-full ${
												c.prioridade === "URGENTE"
													? "bg-red-500"
													: "bg-amber-400"
											}`}
										/>
									)}
									<p className="text-sm font-medium text-gray-900 truncate">
										{c.titulo?.trim() ||
											c.cliente_nome?.trim() ||
											c.numero_pedido}
									</p>
								</div>
								<p className="text-xs text-gray-500 mt-0.5 truncate">
									{STATUS_LABEL[c.status]}
									{c.cliente_nome && c.titulo ? ` · ${c.cliente_nome}` : ""}
									{c.checklist_total > 0 &&
										` · ☑ ${c.checklist_concluidos}/${c.checklist_total}`}
								</p>
							</div>
							<div className="text-right shrink-0">
								{c.data_prazo && (
									<p
										className={`text-xs font-medium tabular-nums ${
											tom === "perigo"
												? "text-perigo"
												: tom === "atencao"
													? "text-atencao"
													: "text-gray-500"
										}`}
									>
										{fmtData(c.data_prazo)}
									</p>
								)}
								{c.financeiro.receita > 0 && (
									<p className="text-[11px] text-gray-400 tabular-nums mt-0.5">
										{fmtBRL(c.financeiro.receita)}
									</p>
								)}
							</div>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
