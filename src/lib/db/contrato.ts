/**
 * Prova, em tempo de compilação, que o schema das migrations casa com o que
 * o código escreve.
 *
 * Não é teste de runtime: são asserções de tipo. Se uma migration mudar uma
 * coluna de forma incompatível com o payload de uma Server Action, o
 * `npm run typecheck` falha aqui — antes de qualquer deploy.
 *
 * Vale principalmente para `pedido` e `pedido_item`, cujo DDL foi
 * RECONSTRUÍDO a partir do código (as tabelas foram criadas à mão no painel e
 * nunca tiveram migration). Aqui a reconstrução é confrontada com o uso real.
 *
 * CUIDADO AO MEXER: a primeira versão deste arquivo usava só
 * `A extends B ? true : false`, que é **vacuoso** para o caso que mais
 * importa. Tipagem estrutural aceita propriedades a mais, então uma coluna
 * inexistente no schema passava batido. As checagens abaixo comparam as
 * chaves explicitamente, e há um teste que sabota o payload de propósito para
 * garantir que elas ainda quebram (tests/unit/contrato.test.ts).
 */
import type { Database, Insert, Row } from "@/lib/db/types";
import type { PedidoStatus } from "@/modules/pedido/status";

// ─── Utilitários de asserção ──────────────────────────────────────────────

/** Falha a compilação quando `T` não é exatamente `true`. */
type Assert<T extends true> = T;

/**
 * `A` é atribuível a `B`? Envolto em tupla para NÃO distribuir sobre uniões —
 * sem isso, `A` sendo união produzia `true | false`, que não é `true` e daria
 * falso negativo confuso.
 */
type Atribuivel<A, B> = [A] extends [B] ? true : false;

/** Chaves de `A` que não existem em `B` — colunas fantasma. */
type ChavesDesconhecidas<A, B> = Exclude<keyof A, keyof B>;

/** Chaves obrigatórias (não-opcionais) de `T`. */
type ChavesObrigatorias<T> = {
	[K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
}[keyof T];

/** Obrigatórias de `B` que `A` não fornece. */
type ObrigatoriasFaltando<A, B> = Exclude<ChavesObrigatorias<B>, keyof A>;

/**
 * `never` vira `true`; qualquer outra coisa vira um objeto de erro cujo campo
 * `chaves` mostra exatamente o que está sobrando/faltando ao passar o mouse.
 */
type ExigirVazio<T, Msg extends string> = [T] extends [never]
	? true
	: { ERRO: Msg; chaves: T };

/**
 * Checagem completa de um payload de insert contra o schema:
 * 1. não escreve coluna que não existe;
 * 2. fornece todas as colunas obrigatórias;
 * 3. os tipos de cada coluna são compatíveis.
 */
type PayloadConfere<A, B> = ExigirVazio<
	ChavesDesconhecidas<A, B>,
	"payload escreve colunas que o schema não tem"
> extends true
	? ExigirVazio<
			ObrigatoriasFaltando<A, B>,
			"payload não fornece colunas obrigatórias do schema"
		> extends true
		? Atribuivel<A, Pick<B, Extract<keyof A, keyof B>>>
		: ExigirVazio<
				ObrigatoriasFaltando<A, B>,
				"payload não fornece colunas obrigatórias do schema"
			>
	: ExigirVazio<
			ChavesDesconhecidas<A, B>,
			"payload escreve colunas que o schema não tem"
		>;

// ─── Enums do banco == enums do código ────────────────────────────────────

type StatusDoBanco = Database["public"]["Enums"]["pedido_status_enum"];

export type _StatusCodigoCabeNoBanco = Assert<
	Atribuivel<PedidoStatus, StatusDoBanco>
>;
export type _StatusBancoCabeNoCodigo = Assert<
	Atribuivel<StatusDoBanco, PedidoStatus>
>;

// ─── O insert de criarPedido cabe no schema ───────────────────────────────

/** Exatamente as chaves que `criarPedido` monta em `.insert({...})`. */
export type PayloadPedido = {
	numero_pedido: string;
	data_pedido: string;
	canal: Database["public"]["Enums"]["canal_pedido_enum"];
	status: StatusDoBanco;
	prioridade: Database["public"]["Enums"]["prioridade_enum"];
	cliente_nome: string | null;
	cliente_telefone: string | null;
	cliente_email: string | null;
	cliente_referencia: string | null;
	data_prazo: string | null;
	forma_pagamento: Database["public"]["Enums"]["forma_pagamento_enum"] | null;
	status_pagamento: Database["public"]["Enums"]["status_pagamento_enum"];
	valor_sinal: number | null;
	desconto_valor: number | null;
	taxa_marketplace_pct: number | null;
	custo_envio: number | null;
	outros_encargos: number | null;
	observacao: string | null;
};

export type _PedidoInsertConfere = Assert<
	PayloadConfere<PayloadPedido, Insert<"pedido">>
>;

/** Exatamente as chaves que `criarPedido` monta para cada item. */
export type PayloadPedidoItem = {
	pedido_id: string;
	tipo: Database["public"]["Enums"]["pedido_item_tipo_enum"];
	modelo_id: string | null;
	descricao_custom: string | null;
	tempo_impressao_min: number | null;
	peso_g: number | null;
	num_placas: number | null;
	quantidade: number;
	preco_venda_unit: number | null;
	custo_unit: number | null;
	observacao: string | null;
};

export type _PedidoItemInsertConfere = Assert<
	PayloadConfere<PayloadPedidoItem, Insert<"pedido_item">>
>;

/** O que `criarEnvio` grava em `envio_item`. */
export type PayloadEnvioItem = {
	envio_id: string;
	modelo_id: string;
	modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
	qtd_enviada: number;
	preco_unitario: number | null;
	preco_2mais: number | null;
	valor_minimo_unit: number | null;
	preco_origem: Database["public"]["Enums"]["preco_origem_enum"];
	qtd_vendida: number | null;
	qtd_devolvida: number | null;
	valor_total_venda: number | null;
	valor_a_receber: number | null;
	preco_cliente: number | null;
	modo_valor: Database["public"]["Enums"]["modo_valor_enum"];
};

export type _EnvioItemInsertConfere = Assert<
	PayloadConfere<PayloadEnvioItem, Insert<"envio_item">>
>;

/** O que `salvarAcertoPorEnvio` grava — inclui a coluna que faltava. */
export type PayloadAcerto = {
	revendedor_id: string;
	envio_id: string;
	modelo_acerto: Database["public"]["Enums"]["modelo_acerto_enum"];
	comissao_calculada: number | null;
	valor_liquido: number | null;
	valor_a_receber: number | null;
	status: Database["public"]["Enums"]["acerto_status_enum"];
	data_conferencia: string | null;
};

export type _AcertoInsertConfere = Assert<
	PayloadConfere<PayloadAcerto, Insert<"acerto">>
>;

// ─── Colunas que já faltaram em migration ─────────────────────────────────

export type _AcertoTemDataConferencia = Assert<
	Atribuivel<Row<"acerto">["data_conferencia"], string | null>
>;

export type _RevendedorTemTokenDeExtrato = Assert<
	Atribuivel<Row<"revendedor">["extrato_token"], string>
>;

export type _RevendedorTemExtratoAtivo = Assert<
	Atribuivel<Row<"revendedor">["extrato_ativo"], boolean>
>;

export type _PedidoTemDatasDeProducao = Assert<
	Atribuivel<
		Pick<
			Row<"pedido">,
			"data_inicio_producao" | "data_conclusao_producao" | "data_entrega"
		>,
		Record<
			"data_inicio_producao" | "data_conclusao_producao" | "data_entrega",
			string | null
		>
	>
>;

// ─── criado_por existe onde a autoria importa ─────────────────────────────

export type _AutoriaEmPedido = Assert<
	Atribuivel<Row<"pedido">["criado_por"], string | null>
>;
export type _AutoriaEmEnvio = Assert<
	Atribuivel<Row<"envio">["criado_por"], string | null>
>;
export type _AutoriaEmAcerto = Assert<
	Atribuivel<Row<"acerto">["criado_por"], string | null>
>;
export type _AutoriaEmProducao = Assert<
	Atribuivel<Row<"producao">["criado_por"], string | null>
>;
export type _AutoriaEmVendaDireta = Assert<
	Atribuivel<Row<"venda_direta">["criado_por"], string | null>
>;
export type _AutoriaEmCalculoCusto = Assert<
	Atribuivel<Row<"calculo_custo">["criado_por"], string | null>
>;

// ─── O módulo de estoque consome as colunas que o banco tem ──────────────

export type _EstoqueLeColunasReais = Assert<
	Atribuivel<
		Pick<
			Row<"envio_item">,
			"modelo_id" | "qtd_enviada" | "qtd_vendida" | "qtd_devolvida"
		>,
		{
			modelo_id: string;
			qtd_enviada: number | null;
			qtd_vendida: number | null;
			qtd_devolvida: number | null;
		}
	>
>;
