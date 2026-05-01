import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import RevendedorTabs from "./RevendedorTabs";

interface Props {
	readonly params: Promise<{ id: string }>;
	readonly children: React.ReactNode;
}

export default async function RevendedorLayout({ params, children }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, nome, modelo_acerto, ativo")
		.eq("revendedor_id", id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">
						{revendedor.nome as string}
					</h1>
					<p className="text-sm text-gray-500 mt-0.5">
						{revendedor.modelo_acerto === "VALOR_MINIMO"
							? "Modelo: Valor por produto"
							: "Modelo: Comissão"}{" "}
						·{" "}
						<span
							className={revendedor.ativo ? "text-green-700" : "text-red-600"}
						>
							{revendedor.ativo ? "Ativo" : "Inativo"}
						</span>
					</p>
				</div>
			</div>

			<RevendedorTabs revendedorId={id} />

			<div>{children}</div>
		</div>
	);
}
