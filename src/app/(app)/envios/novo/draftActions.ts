"use server";

import { createClient } from "@/lib/supabase/server";

export interface DraftState {
	revendedorId: string;
	itens: unknown[];
	step: 1 | 2 | 3;
	dataEnvio: string;
	observacao: string;
}

export async function salvarRascunhoServidor(draft: DraftState): Promise<void> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("envio_draft").upsert(
		{
			user_id: user.id,
			draft_json: draft,
			updated_at: new Date().toISOString(),
		},
		{ onConflict: "user_id" }
	);
}

export async function carregarRascunhoServidor(): Promise<DraftState | null> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return null;

	const { data } = await supabase
		.from("envio_draft")
		.select("draft_json")
		.eq("user_id", user.id)
		.single();

	if (!data?.draft_json) return null;
	return data.draft_json as DraftState;
}

export async function limparRascunhoServidor(): Promise<void> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return;

	await supabase.from("envio_draft").delete().eq("user_id", user.id);
}
