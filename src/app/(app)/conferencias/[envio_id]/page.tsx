import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
	params: Promise<{ envio_id: string }>;
}

export default async function ConferenciaDetalhePage({ params }: PageProps) {
	const { envio_id } = await params;
	const supabase = await createClient();

	const { data: envio } = await supabase
		.from("envio")
		.select("revendedor_id")
		.eq("envio_id", envio_id)
		.is("deleted_at", null)
		.single();

	if (!envio) notFound();

	redirect(`/conferencias/revendedor/${envio.revendedor_id as string}`);
}
