"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registrarRecebimento(
	acertoId: string,
	valorRepassado: number,
	observacao?: string
) {
	if (!acertoId) throw new Error("Acerto invalido");
	if (!Number.isFinite(valorRepassado) || valorRepassado < 0) {
		throw new Error("Valor recebido invalido");
	}

	const supabase = await createClient();

	const { data: acerto, error: acertoError } = await supabase
		.from("acerto")
		.select("acerto_id, envio_id, status")
		.eq("acerto_id", acertoId)
		.is("deleted_at", null)
		.single();

	if (acertoError || !acerto) throw new Error("Acerto nao encontrado");
	if ((acerto.status as string) === "RECEBIDO") {
		throw new Error("Acerto ja recebido");
	}

	const { error: updateAcertoError } = await supabase
		.from("acerto")
		.update({
			status: "RECEBIDO",
			data_recebimento: new Date().toISOString().slice(0, 10),
			valor_repassado: Number(valorRepassado.toFixed(2)),
			observacao: observacao?.trim() || null,
		})
		.eq("acerto_id", acertoId);

	if (updateAcertoError) throw new Error(updateAcertoError.message);

	const { error: updateEnvioError } = await supabase
		.from("envio")
		.update({ status: "ENCERRADO" })
		.eq("envio_id", acerto.envio_id as string)
		.eq("status", "CONFERIDO");

	if (updateEnvioError) throw new Error(updateEnvioError.message);

	revalidatePath("/financeiro");
	revalidatePath("/financeiro/fluxo");
	revalidatePath("/conferencias");
}
