import { createClient } from "@/lib/supabase/server";

export type PrecoOrigem = "MODELO" | "REVENDEDOR" | null;

export interface PrecoResolvido {
preco: number | null;
precoUnitario: number | null;
valorMinimoUnit: number | null;
origem: PrecoOrigem;
}

/**
 * Hierarquia de preco:
 * 1) revendedor_modelo_preco (quantidade_minima = 1)
 * 2) modelo_preco (quantidade_minima = 1)
 * 3) null (manual)
 */
export async function resolverPreco(
modeloId: string,
revendedorId: string
): Promise<PrecoResolvido> {
const supabase = await createClient();

const { data: revRow } = await supabase
.from("revendedor_modelo_preco")
.select("preco, valor_minimo")
.eq("revendedor_id", revendedorId)
.eq("modelo_id", modeloId)
.eq("quantidade_minima", 1)
.eq("ativo", true)
.is("deleted_at", null)
.maybeSingle();

if (revRow) {
return {
preco: revRow.preco ?? revRow.valor_minimo ?? null,
precoUnitario: revRow.preco ?? null,
valorMinimoUnit: revRow.valor_minimo ?? null,
origem: "REVENDEDOR",
};
}

const { data: modeloRow } = await supabase
.from("modelo_preco")
.select("preco")
.eq("modelo_id", modeloId)
.eq("quantidade_minima", 1)
.eq("ativo", true)
.is("deleted_at", null)
.maybeSingle();

if (modeloRow) {
return {
preco: modeloRow.preco ?? null,
precoUnitario: modeloRow.preco ?? null,
valorMinimoUnit: null,
origem: "MODELO",
};
}

return {
preco: null,
precoUnitario: null,
valorMinimoUnit: null,
origem: null,
};
}

export async function resolverPrecoModelo(
modeloId: string
): Promise<PrecoResolvido> {
const supabase = await createClient();

const { data: modeloRow } = await supabase
.from("modelo_preco")
.select("preco")
.eq("modelo_id", modeloId)
.eq("quantidade_minima", 1)
.eq("ativo", true)
.is("deleted_at", null)
.maybeSingle();

if (modeloRow) {
return {
preco: modeloRow.preco ?? null,
precoUnitario: modeloRow.preco ?? null,
valorMinimoUnit: null,
origem: "MODELO",
};
}

return {
preco: null,
precoUnitario: null,
valorMinimoUnit: null,
origem: null,
};
}