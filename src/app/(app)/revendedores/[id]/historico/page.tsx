import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";

interface Props {
	readonly params: Promise<{ id: string }>;
}

function fmtBRL(v: number | null) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString("pt-BR");
}

type TimelineItem = {
	id: string;
	tipo: "ENVIO" | "CONFERENCIA" | "ACERTO";
	data: string;
	titulo: string;
	descricao: string;
	badge?: {
		label: string;
		variant: "info" | "warning" | "success" | "danger" | "neutral";
	};
};

export default async function RevendedorHistoricoPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, nome")
		.eq("revendedor_id", id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	const [{ data: envios }, { data: acertos }] = await Promise.all([
		supabase
			.from("envio")
			.select(
				"envio_id, data_envio, status, observacao, envio_item(qtd_enviada, qtd_vendida)"
			)
			.eq("revendedor_id", id)
			.is("deleted_at", null)
			.order("data_envio", { ascending: false }),
		supabase
			.from("acerto")
			.select(
				"acerto_id, status, modelo_acerto, valor_a_receber, valor_liquido, valor_repassado, data_recebimento, created_at"
			)
			.eq("revendedor_id", id)
			.order("created_at", { ascending: false }),
	]);

	const timeline: TimelineItem[] = [];

	for (const envio of envios ?? []) {
		const items = envio.envio_item as Array<{
			qtd_enviada: number;
			qtd_vendida: number | null;
		}>;
		const totalEnviado = items.reduce(
			(acc, i) => acc + (i.qtd_enviada ?? 0),
			0
		);
		const totalVendido = items.reduce(
			(acc, i) => acc + (i.qtd_vendida ?? 0),
			0
		);

		timeline.push({
			id: `envio-${envio.envio_id}`,
			tipo: "ENVIO",
			data: envio.data_envio as string,
			titulo: "Envio realizado",
			descricao: `${totalEnviado} unidades enviadas`,
			badge:
				envio.status === "ABERTO"
					? { label: "Aberto", variant: "info" }
					: envio.status === "CONFERIDO"
						? { label: "Conferido", variant: "warning" }
						: { label: "Encerrado", variant: "success" },
		});

		if (["CONFERIDO", "ENCERRADO"].includes(envio.status as string)) {
			timeline.push({
				id: `conf-${envio.envio_id}`,
				tipo: "CONFERENCIA",
				data: envio.data_envio as string,
				titulo: "Conferência realizada",
				descricao: `${totalVendido} vendidos de ${totalEnviado} enviados`,
			});
		}
	}

	for (const acerto of acertos ?? []) {
		const val =
			acerto.modelo_acerto === "COMISSAO"
				? (acerto.valor_liquido as number | null)
				: (acerto.valor_a_receber as number | null);

		timeline.push({
			id: `acerto-${acerto.acerto_id}`,
			tipo: "ACERTO",
			data:
				(acerto.data_recebimento as string | null) ??
				(acerto.created_at as string),
			titulo:
				acerto.status === "RECEBIDO" ? "Acerto recebido" : "Acerto gerado",
			descricao: `Valor: ${fmtBRL(val)}${
				acerto.valor_repassado
					? ` · Repassado: ${fmtBRL(acerto.valor_repassado as number)}`
					: ""
			}`,
			badge:
				acerto.status === "RECEBIDO"
					? { label: "Recebido", variant: "success" }
					: { label: "Pendente", variant: "warning" },
		});
	}

	// Sort by date descending
	timeline.sort(
		(a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
	);

	const iconMap: Record<TimelineItem["tipo"], string> = {
		ENVIO: "📦",
		CONFERENCIA: "✅",
		ACERTO: "💰",
	};

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-base font-semibold text-gray-900">Histórico</h2>

			{timeline.length === 0 ? (
				<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-8 text-center text-gray-400 text-sm">
					Nenhuma movimentação encontrada.
				</div>
			) : (
				<div className="flex flex-col gap-0">
					{timeline.map((item, idx) => (
						<div key={item.id} className="flex gap-3">
							{/* Linha vertical */}
							<div className="flex flex-col items-center">
								<div className="w-8 h-8 rounded-full bg-[#E6F1FB] border border-[#B5D4F4] flex items-center justify-center text-sm flex-shrink-0">
									{iconMap[item.tipo]}
								</div>
								{idx < timeline.length - 1 && (
									<div className="w-px flex-1 bg-[#B5D4F4] my-1" />
								)}
							</div>

							{/* Conteúdo */}
							<div className="flex-1 pb-4">
								<div className="flex items-center gap-2 flex-wrap">
									<span className="text-sm font-medium text-gray-900">
										{item.titulo}
									</span>
									{item.badge && (
										<Badge variant={item.badge.variant}>
											{item.badge.label}
										</Badge>
									)}
									<span className="text-xs text-gray-400 ml-auto">
										{fmtDate(item.data)}
									</span>
								</div>
								<p className="text-sm text-gray-500 mt-0.5">{item.descricao}</p>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
