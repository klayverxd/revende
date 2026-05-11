import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Button } from "@/components/ui";
import { CopiarLinkExtrato } from "./CopiarLinkExtrato";

interface Props {
	readonly params: Promise<{ id: string }>;
}

function fmtBRL(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string) {
	return new Date(d).toLocaleDateString("pt-BR");
}

function statusVariant(s: string) {
	if (s === "ABERTO") return "info" as const;
	if (s === "CONFERIDO") return "warning" as const;
	return "success" as const;
}

function statusLabel(s: string) {
	if (s === "ABERTO") return "Aberto";
	if (s === "CONFERIDO") return "Conferido";
	return "Encerrado";
}

export default async function RevendedorVisaoGeralPage({ params }: Props) {
	const { id } = await params;
	const supabase = await createClient();

	const { data: revendedor } = await supabase
		.from("revendedor")
		.select("revendedor_id, nome, modelo_acerto, telefone, email")
		.eq("revendedor_id", id)
		.is("deleted_at", null)
		.single();

	if (!revendedor) notFound();

	const [{ data: enviosRaw }, { data: acertosRaw }] = await Promise.all([
		supabase
			.from("envio")
			.select(
				"envio_id, data_envio, status, envio_item(qtd_enviada, qtd_vendida)"
			)
			.eq("revendedor_id", id)
			.is("deleted_at", null)
			.order("data_envio", { ascending: false }),
		supabase
			.from("acerto")
			.select(
				"valor_a_receber, valor_liquido, valor_repassado, status, modelo_acerto"
			)
			.eq("revendedor_id", id),
	]);

	// KPI calculations
	let totalEnviado = 0;
	let totalVendido = 0;

	for (const envio of enviosRaw ?? []) {
		const items = envio.envio_item as Array<{
			qtd_enviada: number;
			qtd_vendida: number | null;
		}>;
		for (const item of items ?? []) {
			totalEnviado += item.qtd_enviada ?? 0;
			if (["CONFERIDO", "ENCERRADO"].includes(envio.status as string)) {
				totalVendido += item.qtd_vendida ?? 0;
			}
		}
	}

	let receitaGerada = 0;
	let acertosPendentes = 0;

	for (const acerto of acertosRaw ?? []) {
		const val =
			acerto.modelo_acerto === "COMISSAO"
				? ((acerto.valor_liquido as number) ?? 0)
				: ((acerto.valor_a_receber as number) ?? 0);
		if (acerto.status === "PENDENTE") acertosPendentes += val;
		if (acerto.status === "RECEBIDO") receitaGerada += val;
	}

	const giro =
		totalEnviado > 0 ? Math.round((totalVendido / totalEnviado) * 100) : 0;

	const telefone = (revendedor.telefone as string | null) ?? null;
	const email = (revendedor.email as string | null) ?? null;

	// Últimos 5 envios
	const ultimos5 = (enviosRaw ?? []).slice(0, 5);

	const kpis = [
		{ label: "Total enviado", value: `${totalEnviado} un.` },
		{ label: "Total vendido", value: `${totalVendido} un.` },
		{ label: "Giro", value: `${giro}%` },
		{ label: "Receita gerada", value: fmtBRL(receitaGerada) },
		{
			label: "Acertos pendentes",
			value: fmtBRL(acertosPendentes),
			alert: acertosPendentes > 0,
		},
	];

	return (
		<div className="flex flex-col gap-6">
			{/* Contact + action header */}
			<div className="flex items-start justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					{telefone && (
						<p className="text-sm text-gray-600">
							<span className="font-medium">Tel:</span> {telefone}
						</p>
					)}
					{email && (
						<p className="text-sm text-gray-600">
							<span className="font-medium">E-mail:</span> {email}
						</p>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Link href={`/envios/novo?revendedor=${id}`}>
						<Button size="sm">+ Novo envio</Button>
					</Link>
					<CopiarLinkExtrato revendedorId={id} />
				</div>
			</div>

			{/* KPI Cards */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-3">
				{kpis.map(kpi => (
					<div
						key={kpi.label}
						className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-3"
					>
						<p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
						<p
							className={`text-lg font-semibold ${
								kpi.alert ? "text-amber-700" : "text-gray-900"
							}`}
						>
							{kpi.value}
						</p>
					</div>
				))}
			</div>

			{/* Últimos envios */}
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-base font-semibold text-gray-900">
						Últimos envios
					</h2>
					<Link
						href={`/envios?revendedor=${id}`}
						className="text-sm text-[#378ADD] hover:underline"
					>
						Ver todos
					</Link>
				</div>

				{ultimos5.length === 0 ? (
					<div className="bg-white rounded-xl border border-[#B5D4F4] px-4 py-8 text-center text-gray-400 text-sm">
						Nenhum envio registrado ainda.
					</div>
				) : (
					<div className="bg-white rounded-xl border border-[#B5D4F4] overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
									<th className="px-4 py-2.5 text-left font-medium text-gray-600">
										Data
									</th>
									<th className="px-4 py-2.5 text-right font-medium text-gray-600">
										Itens enviados
									</th>
									<th className="px-4 py-2.5 text-right font-medium text-gray-600">
										Itens vendidos
									</th>
									<th className="px-4 py-2.5 text-center font-medium text-gray-600">
										Status
									</th>
									<th className="px-4 py-2.5" />
								</tr>
							</thead>
							<tbody>
								{ultimos5.map(envio => {
									const items = envio.envio_item as Array<{
										qtd_enviada: number;
										qtd_vendida: number | null;
									}>;
									const enviado = items.reduce(
										(acc, i) => acc + (i.qtd_enviada ?? 0),
										0
									);
									const vendido = items.reduce(
										(acc, i) => acc + (i.qtd_vendida ?? 0),
										0
									);
									return (
										<tr
											key={envio.envio_id as string}
											className="border-b border-[#B5D4F4] last:border-0 hover:bg-[#F4F8FD]"
										>
											<td className="px-4 py-2.5 text-gray-700">
												{fmtDate(envio.data_envio as string)}
											</td>
											<td className="px-4 py-2.5 text-right text-gray-700">
												{enviado}
											</td>
											<td className="px-4 py-2.5 text-right text-gray-700">
												{["CONFERIDO", "ENCERRADO"].includes(
													envio.status as string
												)
													? vendido
													: "—"}
											</td>
											<td className="px-4 py-2.5 text-center">
												<Badge variant={statusVariant(envio.status as string)}>
													{statusLabel(envio.status as string)}
												</Badge>
											</td>
											<td className="px-4 py-2.5 text-right">
												<Link href={`/envios/${envio.envio_id as string}`}>
													<Button variant="ghost" size="sm">
														Ver
													</Button>
												</Link>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
