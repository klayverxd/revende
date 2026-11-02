/**
 * Tipos compartilhados do módulo de conferências.
 *
 * Antes viviam dentro de `[envio_id]/ConferenciaForm.tsx` — 403 linhas de
 * componente inalcançável (a rota sempre redireciona) que só sobreviviam
 * porque duas telas importavam este tipo de lá.
 */

export interface RevendedorResumo {
	revendedor_id: string;
	nome: string;
	modelo_acerto: "COMISSAO" | "VALOR_MINIMO";
	comissao_fixa?: number | null;
	comissao_pct?: number | null;
}
