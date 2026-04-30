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

	const { data: envioItens, error: itensError } = await supabase
		.from("envio_item")
		.select("qtd_enviada, qtd_vendida, qtd_devolvida")
		.eq("envio_id", acerto.envio_id as string)
		.is("deleted_at", null);

	if (itensError) throw new Error(itensError.message);

	const temItensComRevendedor = (envioItens ?? []).some(i => {
		const qtdEnviada = (i.qtd_enviada as number) ?? 0;
		const qtdVendida = (i.qtd_vendida as number | null) ?? 0;
		const qtdDevolvida = (i.qtd_devolvida as number | null) ?? 0;
		return qtdEnviada > qtdVendida + qtdDevolvida;
	});

	const proximoStatus = temItensComRevendedor ? "CONFERIDO" : "ENCERRADO";

	const { error: updateEnvioError } = await supabase
		.from("envio")
		.update({ status: proximoStatus })
		.eq("envio_id", acerto.envio_id as string);

	if (updateEnvioError) throw new Error(updateEnvioError.message);

	revalidatePath("/financeiro");
	revalidatePath("/financeiro/fluxo");
	revalidatePath("/conferencias");
	revalidatePath("/envios");
	revalidatePath("/estoque");
	revalidatePath("/dashboard");
}
