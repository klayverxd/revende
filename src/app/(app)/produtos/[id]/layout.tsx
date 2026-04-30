import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProdutoTabs from "./ProdutoTabs";

interface Props {
	readonly children: React.ReactNode;
	readonly params: Promise<{ id: string }>;
}

export default async function ProdutoLayout({ children, params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: modelo } = await supabase
		.from("modelo")
		.select("modelo_id, codigo, nome")
		.eq("modelo_id", id)
		.is("deleted_at", null)
		.single();

	if (!modelo) notFound();

	return (
		<div className="flex flex-col gap-6">
			<div>
				<p className="text-xs text-gray-400 font-mono mb-0.5">
					{modelo.codigo}
				</p>
				<h1 className="text-xl font-semibold text-gray-900">{modelo.nome}</h1>
			</div>
			<ProdutoTabs modeloId={id} />
			{children}
		</div>
	);
}
