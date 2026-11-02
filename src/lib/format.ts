/**
 * Formatação e parsing — fonte única.
 *
 * Substitui as 24 definições de fmtCurrency, 13 de fmtDate e 5 de clamp/toNumber
 * que estavam espalhadas pelas telas. Não importa Supabase, React nem Next:
 * pode ser usado em Server Components, Client Components e testes.
 */

// ─── Moeda e números ──────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

/** Formata como R$ 1.234,56. Nulo/undefined/NaN viram travessão. */
export function fmtBRL(v: number | null | undefined): string {
	if (v == null || !Number.isFinite(v)) return "—";
	return BRL.format(v);
}

/** Como fmtBRL, mas nulo vira "R$ 0,00" em vez de travessão. */
export function fmtBRLZero(v: number | null | undefined): string {
	return BRL.format(v != null && Number.isFinite(v) ? v : 0);
}

/**
 * Formata fração como percentual: 0.3 → "30%".
 * Passe `fracao: false` se o valor já estiver em pontos percentuais (30 → "30%").
 */
export function fmtPct(
	v: number | null | undefined,
	{ casas = 0, fracao = true }: { casas?: number; fracao?: boolean } = {}
): string {
	if (v == null || !Number.isFinite(v)) return "—";
	const pontos = fracao ? v * 100 : v;
	return `${pontos.toFixed(casas).replace(".", ",")}%`;
}

/** Formata quantidade inteira sem casas decimais. */
export function fmtQtd(v: number | null | undefined): string {
	if (v == null || !Number.isFinite(v)) return "0";
	return new Intl.NumberFormat("pt-BR").format(v);
}

// ─── Datas ────────────────────────────────────────────────────────────────

/**
 * Formata uma data ISO (`YYYY-MM-DD` ou timestamp) como `DD/MM/AAAA`.
 *
 * Trabalha sobre a string, sem construir `Date` — é o que evita o
 * deslocamento de um dia que acontecia nas telas que usavam `new Date(d)`
 * em colunas do tipo DATE.
 */
export function fmtData(s: string | null | undefined): string {
	if (!s) return "—";
	const d = s.slice(0, 10);
	if (d.length !== 10) return "—";
	return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Formata timestamp como `DD/MM/AAAA HH:MM` no fuso local. */
export function fmtDataHora(s: string | null | undefined): string {
	if (!s) return "—";
	const dt = new Date(s);
	if (Number.isNaN(dt.getTime())) return "—";
	const dia = String(dt.getDate()).padStart(2, "0");
	const mes = String(dt.getMonth() + 1).padStart(2, "0");
	const hora = String(dt.getHours()).padStart(2, "0");
	const min = String(dt.getMinutes()).padStart(2, "0");
	return `${dia}/${mes}/${dt.getFullYear()} ${hora}:${min}`;
}

/** Data de hoje como `YYYY-MM-DD` no fuso local (não UTC). */
export function hojeISO(): string {
	const d = new Date();
	const mes = String(d.getMonth() + 1).padStart(2, "0");
	const dia = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Dias corridos entre duas datas `YYYY-MM-DD`. Positivo se `ate` é posterior.
 * Comparação por data pura, sem hora nem fuso.
 */
export function diasEntre(de: string, ate: string = hojeISO()): number {
	const a = Date.parse(`${de.slice(0, 10)}T00:00:00Z`);
	const b = Date.parse(`${ate.slice(0, 10)}T00:00:00Z`);
	if (Number.isNaN(a) || Number.isNaN(b)) return 0;
	return Math.round((b - a) / 86_400_000);
}

// ─── Parsing de entrada do usuário ────────────────────────────────────────

/**
 * Converte texto digitado em número, aceitando os formatos que aparecem
 * de fato nos campos: `1234.56`, `1234,56` e `1.234,56`.
 *
 * Retorna 0 para vazio ou inválido — nunca NaN.
 */
export function parseNum(s: string | number | null | undefined): number {
	if (typeof s === "number") return Number.isFinite(s) ? s : 0;
	if (!s) return 0;

	let t = s.trim().replace(/\s/g, "");
	if (!t) return 0;

	const temPonto = t.includes(".");
	const temVirgula = t.includes(",");

	if (temPonto && temVirgula) {
		// "1.234,56" — ponto é separador de milhar, vírgula é decimal
		t = t.replace(/\./g, "").replace(",", ".");
	} else if (temVirgula) {
		t = t.replace(",", ".");
	}

	const n = Number.parseFloat(t);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Converte um tempo digitado em **minutos**.
 *
 * Formatos aceitos:
 * - `2h30`, `2h30m`, `2h` → horas e minutos
 * - `2,5h`, `2.5h`        → horas fracionadas
 * - `2:30`                → h:mm
 * - `90m`, `90min`        → minutos
 * - `150`                 → minutos (número solto é sempre minuto)
 *
 * Retorna 0 quando não reconhece.
 */
export function parseTempo(s: string | number | null | undefined): number {
	if (typeof s === "number") return Number.isFinite(s) ? Math.max(0, s) : 0;
	if (!s) return 0;

	const t = s.trim().toLowerCase().replace(/\s/g, "");
	if (!t) return 0;

	// 2:30
	const hhmm = /^(\d+):(\d{1,2})$/.exec(t);
	if (hhmm) {
		return Number(hhmm[1]) * 60 + Number(hhmm[2]);
	}

	// 2h30 / 2h30m / 2h / 2,5h
	const comH = /^(\d+(?:[.,]\d+)?)h(?:(\d+)m?)?$/.exec(t);
	if (comH) {
		const horas = parseNum(comH[1]);
		const min = comH[2] ? Number(comH[2]) : 0;
		return Math.round(horas * 60 + min);
	}

	// 90m / 90min
	const comM = /^(\d+(?:[.,]\d+)?)m(?:in)?$/.exec(t);
	if (comM) {
		return Math.round(parseNum(comM[1]));
	}

	// número solto = minutos
	const solto = /^\d+(?:[.,]\d+)?$/.exec(t);
	if (solto) {
		return Math.round(parseNum(t));
	}

	return 0;
}

/** Minutos → `2h30` (ou `45min` quando menos de uma hora). */
export function fmtTempo(min: number | null | undefined): string {
	if (min == null || !Number.isFinite(min) || min <= 0) return "—";
	const total = Math.round(min);
	const h = Math.floor(total / 60);
	const m = total % 60;
	if (h === 0) return `${m}min`;
	if (m === 0) return `${h}h`;
	return `${h}h${String(m).padStart(2, "0")}`;
}

// ─── Utilitários numéricos ────────────────────────────────────────────────

/** Limita `value` ao intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * Arredonda para `casas` decimais devolvendo número (não string), com
 * arredondamento "meio para longe do zero" — o que se espera de dinheiro.
 *
 * O `toFixed(8)` intermediário não é enfeite: `1.005 * 100` vale
 * `100.49999999999999` em IEEE-754, então `Math.round` sozinho devolveria
 * `1.00` em vez de `1.01`. Normalizar a escala antes de arredondar corrige
 * essa classe de centavo perdido.
 */
export function arredondar(v: number, casas = 2): number {
	if (!Number.isFinite(v)) return 0;
	const f = 10 ** casas;
	const escalado = Number((v * f).toFixed(8));
	const inteiro = v < 0 ? -Math.round(-escalado) : Math.round(escalado);
	return inteiro / f;
}
