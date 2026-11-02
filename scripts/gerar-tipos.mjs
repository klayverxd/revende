/**
 * Gera src/lib/db/types.ts a partir das MIGRATIONS, sem credencial nenhuma.
 *
 * Como funciona: sobe um PostgreSQL real (PGlite — Postgres compilado para
 * WASM, dentro do pacote npm), aplica todas as migrations em ordem e
 * introspecciona `information_schema` / `pg_catalog` para emitir o tipo
 * `Database` no formato que o `@supabase/supabase-js` espera.
 *
 * Por que não o `supabase gen types`: o caminho oficial exige `supabase login`
 * com um token pessoal da conta. Tentei também apontar o CLI para este mesmo
 * Postgres via socket TCP, mas o probe de SSL do CLI (`LegacyPgDeltaSslProbe`)
 * não completa contra o servidor do PGlite, e não há flag para desligá-lo.
 *
 * A geração local acabou sendo melhor de qualquer forma: os tipos refletem
 * **as migrations do repositório**, não o estado de um banco que alguém pode
 * ter editado à mão no painel. Se os dois divergirem, o modo --check acusa.
 *
 * Uso:
 *   node scripts/gerar-tipos.mjs            grava o arquivo
 *   node scripts/gerar-tipos.mjs --check     falha se estiver desatualizado
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const RAIZ = process.cwd();
const MIGRATIONS = path.join(RAIZ, "supabase", "migrations");
const PRELUDIO = path.join(RAIZ, "scripts", "preludio.sql");
const SAIDA = path.join(RAIZ, "src", "lib", "db", "types.ts");
const CHECAR = process.argv.includes("--check");

// ─── Mapeamento de tipos Postgres → TypeScript ────────────────────────────

const NUMERICOS = new Set([
	"smallint",
	"integer",
	"bigint",
	"decimal",
	"numeric",
	"real",
	"double precision",
	"int2",
	"int4",
	"int8",
	"float4",
	"float8",
]);

const TEXTUAIS = new Set([
	"text",
	"character varying",
	"character",
	"varchar",
	"char",
	"name",
	"citext",
]);

// Datas viram string: é o que o Supabase devolve no JSON, e é o que o código
// já trata (as colunas DATE são manipuladas como "YYYY-MM-DD").
const DATAS = new Set([
	"date",
	"timestamp",
	"timestamp with time zone",
	"timestamp without time zone",
	"time",
	"time with time zone",
	"time without time zone",
	"interval",
]);

function tipoTs(coluna, enums) {
	const { data_type: dt, udt_name: udt } = coluna;

	if (dt === "ARRAY") {
		// udt_name de array vem prefixado com "_": _text, _int4…
		const base = udt.replace(/^_/, "");
		const interno = tipoTs(
			{ data_type: base, udt_name: base, element_type: null },
			enums
		);
		return `${interno}[]`;
	}

	if (enums.has(udt)) return `Database["public"]["Enums"]["${udt}"]`;
	if (dt === "uuid" || udt === "uuid") return "string";
	if (NUMERICOS.has(dt) || NUMERICOS.has(udt)) return "number";
	if (TEXTUAIS.has(dt) || TEXTUAIS.has(udt)) return "string";
	if (DATAS.has(dt) || DATAS.has(udt)) return "string";
	if (dt === "boolean" || udt === "bool") return "boolean";
	if (dt === "jsonb" || dt === "json" || udt === "jsonb" || udt === "json")
		return "Json";
	if (dt === "bytea") return "string";

	// Tipo desconhecido: `unknown` obriga a tratar explicitamente, em vez de
	// mentir com `any`.
	return "unknown";
}

// ─── Sobe o banco e aplica as migrations ──────────────────────────────────

const db = await PGlite.create({ extensions: { uuid_ossp } });
await db.exec(readFileSync(PRELUDIO, "utf8"));

const arquivos = readdirSync(MIGRATIONS)
	.filter(f => f.endsWith(".sql"))
	.sort();

for (const arquivo of arquivos) {
	try {
		await db.exec(readFileSync(path.join(MIGRATIONS, arquivo), "utf8"));
	} catch (e) {
		console.error(`Migration ${arquivo} falhou: ${e.message}`);
		process.exit(1);
	}
}

// ─── Introspecção ─────────────────────────────────────────────────────────

const { rows: enumRows } = await db.query(`
  SELECT t.typname AS nome, e.enumlabel AS valor
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'public'
  ORDER BY t.typname, e.enumsortorder
`);

const enums = new Map();
for (const { nome, valor } of enumRows) {
	if (!enums.has(nome)) enums.set(nome, []);
	enums.get(nome).push(valor);
}

const { rows: tabelaRows } = await db.query(`
  SELECT table_name AS nome
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name
`);

const { rows: colunaRows } = await db.query(`
  SELECT table_name, column_name, data_type, udt_name,
         is_nullable, column_default, is_identity
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`);

const porTabela = new Map();
for (const c of colunaRows) {
	if (!porTabela.has(c.table_name)) porTabela.set(c.table_name, []);
	porTabela.get(c.table_name).push(c);
}

// Relacionamentos, para o Supabase resolver joins aninhados no select.
const { rows: fkRows } = await db.query(`
  SELECT
    tc.constraint_name  AS nome,
    kcu.table_name      AS tabela,
    kcu.column_name     AS coluna,
    ccu.table_name      AS ref_tabela,
    ccu.column_name     AS ref_coluna
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  ORDER BY kcu.table_name, tc.constraint_name
`);

const fksPorTabela = new Map();
for (const fk of fkRows) {
	if (!fksPorTabela.has(fk.tabela)) fksPorTabela.set(fk.tabela, []);
	fksPorTabela.get(fk.tabela).push(fk);
}

await db.close();

// ─── Emissão ──────────────────────────────────────────────────────────────

const ind = (n) => "\t".repeat(n);
const L = [];

L.push("/**");
L.push(" * GERADO AUTOMATICAMENTE — não edite à mão.");
L.push(" *");
L.push(" * Fonte: supabase/migrations/*.sql, aplicadas num Postgres limpo.");
L.push(" * Regenerar:  npm run db:types");
L.push(" * Verificar:  npm run db:types:check   (usado no CI)");
L.push(" *");
L.push(` * ${arquivos.length} migrations · ${tabelaRows.length} tabelas · ${enums.size} enums`);
L.push(" */");
L.push("");
L.push("export type Json =");
L.push(`${ind(1)}| string`);
L.push(`${ind(1)}| number`);
L.push(`${ind(1)}| boolean`);
L.push(`${ind(1)}| null`);
L.push(`${ind(1)}| { [key: string]: Json | undefined }`);
L.push(`${ind(1)}| Json[];`);
L.push("");
L.push("export type Database = {");
L.push(`${ind(1)}public: {`);
L.push(`${ind(2)}Tables: {`);

for (const { nome: tabela } of tabelaRows) {
	const colunas = porTabela.get(tabela) ?? [];
	L.push(`${ind(3)}${tabela}: {`);

	// Row — o que vem do banco.
	L.push(`${ind(4)}Row: {`);
	for (const c of colunas) {
		const t = tipoTs(c, enums);
		const nulo = c.is_nullable === "YES" ? " | null" : "";
		L.push(`${ind(5)}${c.column_name}: ${t}${nulo};`);
	}
	L.push(`${ind(4)}};`);

	// Insert — opcional quando tem DEFAULT, é identity ou aceita NULL.
	L.push(`${ind(4)}Insert: {`);
	for (const c of colunas) {
		const t = tipoTs(c, enums);
		const nulo = c.is_nullable === "YES" ? " | null" : "";
		const temDefault =
			c.column_default !== null || c.is_identity === "YES";
		const opcional = temDefault || c.is_nullable === "YES" ? "?" : "";
		L.push(`${ind(5)}${c.column_name}${opcional}: ${t}${nulo};`);
	}
	L.push(`${ind(4)}};`);

	// Update — tudo opcional.
	L.push(`${ind(4)}Update: {`);
	for (const c of colunas) {
		const t = tipoTs(c, enums);
		const nulo = c.is_nullable === "YES" ? " | null" : "";
		L.push(`${ind(5)}${c.column_name}?: ${t}${nulo};`);
	}
	L.push(`${ind(4)}};`);

	// Relationships — o Supabase usa para tipar `select("a, rel:tabela(...)")`.
	const fks = fksPorTabela.get(tabela) ?? [];
	if (fks.length === 0) {
		L.push(`${ind(4)}Relationships: [];`);
	} else {
		L.push(`${ind(4)}Relationships: [`);
		for (const fk of fks) {
			L.push(`${ind(5)}{`);
			L.push(`${ind(6)}foreignKeyName: "${fk.nome}";`);
			L.push(`${ind(6)}columns: ["${fk.coluna}"];`);
			L.push(`${ind(6)}isOneToOne: false;`);
			L.push(`${ind(6)}referencedRelation: "${fk.ref_tabela}";`);
			L.push(`${ind(6)}referencedColumns: ["${fk.ref_coluna}"];`);
			L.push(`${ind(5)}},`);
		}
		L.push(`${ind(4)}];`);
	}

	L.push(`${ind(3)}};`);
}

L.push(`${ind(2)}};`);
L.push(`${ind(2)}Views: Record<string, never>;`);
L.push(`${ind(2)}Functions: Record<string, never>;`);
L.push(`${ind(2)}Enums: {`);
for (const [nome, valores] of [...enums.entries()].sort()) {
	const uniao = valores.map(v => `"${v}"`).join(" | ");
	L.push(`${ind(3)}${nome}: ${uniao};`);
}
L.push(`${ind(2)}};`);
L.push(`${ind(2)}CompositeTypes: Record<string, never>;`);
L.push(`${ind(1)}};`);
L.push("};");
L.push("");
L.push("/** Atalho para a linha de uma tabela: `Row<\"pedido\">`. */");
L.push(
	'export type Row<T extends keyof Database["public"]["Tables"]> ='
);
L.push(`${ind(1)}Database["public"]["Tables"][T]["Row"];`);
L.push("");
L.push('/** Atalho para o payload de insert: `Insert<"pedido">`. */');
L.push(
	'export type Insert<T extends keyof Database["public"]["Tables"]> ='
);
L.push(`${ind(1)}Database["public"]["Tables"][T]["Insert"];`);
L.push("");
L.push('/** Atalho para um enum: `Enum<"modelo_acerto_enum">`. */');
L.push('export type Enum<T extends keyof Database["public"]["Enums"]> =');
L.push(`${ind(1)}Database["public"]["Enums"][T];`);
L.push("");

const conteudo = L.join("\n");

if (CHECAR) {
	let atual = null;
	try {
		atual = readFileSync(SAIDA, "utf8");
	} catch {
		console.error(
			`${path.relative(RAIZ, SAIDA)} não existe. Rode: npm run db:types`
		);
		process.exit(1);
	}
	if (atual.replace(/\r\n/g, "\n") !== conteudo.replace(/\r\n/g, "\n")) {
		console.error(
			"Os tipos estão dessincronizados das migrations.\n" +
				"Alguma migration mudou sem regenerar. Rode: npm run db:types"
		);
		process.exit(1);
	}
	console.log(
		`Tipos em sincronia com as ${arquivos.length} migrations ` +
			`(${tabelaRows.length} tabelas, ${enums.size} enums).`
	);
} else {
	mkdirSync(path.dirname(SAIDA), { recursive: true });
	writeFileSync(SAIDA, conteudo, "utf8");
	console.log(
		`${path.relative(RAIZ, SAIDA)} — ${tabelaRows.length} tabelas, ` +
			`${enums.size} enums, a partir de ${arquivos.length} migrations.`
	);
}
