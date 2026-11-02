/**
 * Carregamento dos cards da esteira de produção.
 *
 * Separa I/O de cálculo: as queries ficam aqui, a aritmética em
 * `@/modules/pedido/financeiro` e o mapeamento status→coluna em
 * `@/modules/pedido/status`.
 */
import { createClient } from "@/lib/supabase/server";
import { exigirSemErro } from "@/lib/queries/erro";
import {
	calcularFinanceiroPedido,
	type FinanceiroPedido,
} from "@/modules/pedido/financeiro";
import type {
	CanalPedido,
	PedidoStatus,
	Prioridade,
} from "@/modules/pedido/status";

export interface EtiquetaCard {
	etiqueta_id: string;
	nome: string;
	cor: string;
}

export interface CardEsteira {
	pedido_id: string;
	numero_pedido: string;
	titulo: string | null;
	status: PedidoStatus;
	prioridade: Prioridade;
	canal: CanalPedido;
	cliente_nome: string | null;
	data_prazo: string | null;
	prazo_concluido: boolean;
	capa_url: string | null;
	ordem_esteira: number | null;
	responsavel_id: string | null;
	/** Só a existência importa na frente do card; o texto fica no detalhe. */
	tem_descricao: boolean;
	etiquetas: EtiquetaCard[];
	checklist_total: number;
	checklist_concluidos: number;
	comentarios: number;
	anexos: number;
	produtos: string[];
	financeiro: FinanceiroPedido;
}

interface LinhaJoin {
	pedido_id: string;
	numero_pedido: string;
	titulo: string | null;
	descricao_md: string | null;
	status: string;
	prioridade: string;
	canal: string;
	cliente_nome: string | null;
	data_prazo: string | null;
	prazo_concluido: boolean | null;
	capa_url: string | null;
	ordem_esteira: number | null;
	responsavel_id: string | null;
	desconto_valor: number | null;
	taxa_marketplace_pct: number | null;
	custo_envio: number | null;
	outros_encargos: number | null;
	itens: unknown;
	etiquetas: unknown;
}

/** Junções to-many do Supabase podem chegar como objeto único. */
function lista<T>(v: unknown): T[] {
	if (v == null) return [];
	return Array.isArray(v) ? (v as T[]) : [v as T];
}

/**
 * Todos os cards ativos da esteira.
 *
 * As colunas terminais (Concluídos e Cancelados) trazem apenas os mais
 * recentes: o histórico completo tem ano de dados e não cabe no kanban — quem
 * quer tudo usa a visão de tabela em /producao/lista.
 */
export async function buscarCardsEsteira(
	{ limiteFinalizados = 30 }: { limiteFinalizados?: number } = {}
): Promise<CardEsteira[]> {
	const supabase = await createClient();

	const SELECT = `
		pedido_id, numero_pedido, titulo, descricao_md, status, prioridade, canal,
		cliente_nome, data_prazo, prazo_concluido, capa_url, ordem_esteira,
		responsavel_id, desconto_valor, taxa_marketplace_pct, custo_envio,
		outros_encargos,
		itens:pedido_item(quantidade, preco_venda_unit, custo_unit,
			descricao_custom, modelo:modelo_id(nome)),
		etiquetas:pedido_etiqueta(etiqueta:etiqueta_id(etiqueta_id, nome, cor))
	`;

	const [
		{ data: ativos, error: erroAtivos },
		{ data: finalizados, error: erroFinalizados },
	] = await Promise.all([
		supabase
			.from("pedido")
			.select(SELECT)
			.is("deleted_at", null)
			.not("status", "in", '("ENTREGUE","CANCELADO")')
			.order("ordem_esteira", { ascending: true, nullsFirst: false }),
		supabase
			.from("pedido")
			.select(SELECT)
			.is("deleted_at", null)
			.in("status", ["ENTREGUE", "CANCELADO"])
			.order("updated_at", { ascending: false })
			.limit(limiteFinalizados),
	]);

	exigirSemErro(erroAtivos, "Não foi possível carregar a esteira");
	exigirSemErro(erroFinalizados, "Não foi possível carregar a esteira");

	const linhas = [
		...((ativos ?? []) as unknown as LinhaJoin[]),
		...((finalizados ?? []) as unknown as LinhaJoin[]),
	];

	if (linhas.length === 0) return [];

	const ids = linhas.map(l => l.pedido_id);

	// Contagens vêm em queries próprias: fazer tudo num join só multiplicaria
	// as linhas de itens por checklist por comentário.
	const [
		{ data: checklistItens, error: erroChecklist },
		{ data: comentarios, error: erroComentarios },
		{ data: anexos, error: erroAnexos },
	] = await Promise.all([
		supabase
			.from("pedido_checklist_item")
			.select("item_id, concluido, checklist:checklist_id(pedido_id)")
			.is("deleted_at", null),
		supabase
			.from("pedido_comentario")
			.select("pedido_id")
			.in("pedido_id", ids)
			.is("deleted_at", null),
		supabase
			.from("pedido_anexo")
			.select("pedido_id")
			.in("pedido_id", ids)
			.is("deleted_at", null),
	]);

	exigirSemErro(erroChecklist, "Não foi possível carregar as checklists");
	exigirSemErro(erroComentarios, "Não foi possível carregar os comentários");
	exigirSemErro(erroAnexos, "Não foi possível carregar os anexos");

	const checklistPorPedido = new Map<string, { total: number; feitos: number }>();
	for (const item of checklistItens ?? []) {
		const c = item.checklist as unknown as { pedido_id: string } | null;
		const pedidoId = Array.isArray(c) ? c[0]?.pedido_id : c?.pedido_id;
		if (!pedidoId) continue;
		const atual = checklistPorPedido.get(pedidoId) ?? { total: 0, feitos: 0 };
		atual.total += 1;
		if (item.concluido) atual.feitos += 1;
		checklistPorPedido.set(pedidoId, atual);
	}

	const contar = (rows: { pedido_id: string }[] | null) => {
		const m = new Map<string, number>();
		for (const r of rows ?? []) {
			m.set(r.pedido_id, (m.get(r.pedido_id) ?? 0) + 1);
		}
		return m;
	};
	const comentariosPorPedido = contar(comentarios as { pedido_id: string }[]);
	const anexosPorPedido = contar(anexos as { pedido_id: string }[]);

	return linhas.map(l => {
		const itens = lista<{
			quantidade: number | null;
			preco_venda_unit: number | null;
			custo_unit: number | null;
			descricao_custom: string | null;
			modelo: { nome: string } | { nome: string }[] | null;
		}>(l.itens);

		const produtos = itens
			.map(i => {
				const m = Array.isArray(i.modelo) ? i.modelo[0] : i.modelo;
				return m?.nome ?? i.descricao_custom ?? "";
			})
			.filter(Boolean);

		const etiquetas = lista<{
			etiqueta: EtiquetaCard | EtiquetaCard[] | null;
		}>(l.etiquetas)
			.map(e => (Array.isArray(e.etiqueta) ? e.etiqueta[0] : e.etiqueta))
			.filter((e): e is EtiquetaCard => Boolean(e));

		const checklist = checklistPorPedido.get(l.pedido_id) ?? {
			total: 0,
			feitos: 0,
		};

		return {
			pedido_id: l.pedido_id,
			numero_pedido: l.numero_pedido,
			titulo: l.titulo,
			status: l.status as PedidoStatus,
			prioridade: l.prioridade as Prioridade,
			canal: l.canal as CanalPedido,
			cliente_nome: l.cliente_nome,
			data_prazo: l.data_prazo,
			prazo_concluido: l.prazo_concluido ?? false,
			capa_url: l.capa_url,
			ordem_esteira: l.ordem_esteira,
			responsavel_id: l.responsavel_id,
			tem_descricao: Boolean(l.descricao_md?.trim()),
			etiquetas,
			checklist_total: checklist.total,
			checklist_concluidos: checklist.feitos,
			comentarios: comentariosPorPedido.get(l.pedido_id) ?? 0,
			anexos: anexosPorPedido.get(l.pedido_id) ?? 0,
			produtos,
			financeiro: calcularFinanceiroPedido(l, itens),
		};
	});
}

/** Etiquetas disponíveis no workspace, para o seletor do card. */
export async function buscarEtiquetas(): Promise<EtiquetaCard[]> {
	const supabase = await createClient();
	const { data, error } = await supabase
		.from("etiqueta")
		.select("etiqueta_id, nome, cor")
		.is("deleted_at", null)
		.order("ordem")
		.order("nome");
	exigirSemErro(error, "Não foi possível carregar as etiquetas");
	return (data ?? []) as EtiquetaCard[];
}
