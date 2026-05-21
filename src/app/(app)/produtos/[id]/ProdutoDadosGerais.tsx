"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import FotoUpload from "@/components/ui/FotoUpload";
import ProdutoModal from "../ProdutoModal";

interface Modelo {
	modelo_id: string;
	codigo: string;
	nome: string;
	descricao?: string | null;
	custo_producao?: number | null;
	estoque_minimo?: number | null;
	ativo: boolean;
	preco_unitario?: number | null;
	preco_atacado?: number | null;
	qtd_minima_atacado?: number | null;
	foto_url?: string | null;
}

interface UltimoCalculo {
	calculo_id: string;
	created_at: string;
	equipamento_id: string | null;
	materias_primas: { materia_prima_id: string; quantidade: number }[] | null;
	custo_extra_id: string | null;
	tempo_impressao_min: number;
	quantidade: number;
	num_placas: number | null;
	custo_energia: number;
	custo_materias_primas: number;
	custo_depreciacao: number;
	custo_falhas: number;
	custo_extra: number | null;
	custo_total: number;
	custo_unitario: number;
	pct_falhas: number;
	config_equipamento: { nome: string } | null;
}

interface Props {
	readonly modelo: Modelo;
	readonly ultimoCalculo: UltimoCalculo | null;
}

function fmt(v: number | null | undefined) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProdutoDadosGerais({ modelo, ultimoCalculo }: Props) {
	const [editOpen, setEditOpen] = useState(false);
	const router = useRouter();

	function preencherCalculadora() {
		if (!ultimoCalculo) return;
		const primeiraMateria = ultimoCalculo.materias_primas?.[0];
		const qtdTotal = ultimoCalculo.quantidade;
		const placas = ultimoCalculo.num_placas ?? 1;
		const custoExtraUnitario =
			ultimoCalculo.custo_extra != null && qtdTotal > 0
				? ultimoCalculo.custo_extra / qtdTotal
				: 0;
		const load = {
			equipamento_id: ultimoCalculo.equipamento_id ?? "",
			tempo_impressao_min: ultimoCalculo.tempo_impressao_min,
			num_placas: placas,
			quantidade_total: qtdTotal,
			materia_prima_id: primeiraMateria?.materia_prima_id ?? "",
			materia_qtd_internal: primeiraMateria?.quantidade ?? 0,
			custo_extra_id: ultimoCalculo.custo_extra_id,
			custo_extra_unitario: custoExtraUnitario,
		};
		localStorage.setItem("calculadora_load", JSON.stringify(load));
		router.push("/calculadora");
	}

	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] p-6 flex flex-col gap-5 max-w-xl">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold text-gray-900">Dados gerais</h2>
				<Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
					Editar
				</Button>
			</div>

			<FotoUpload
				modeloId={modelo.modelo_id}
				fotoUrl={modelo.foto_url ?? null}
			/>

			<dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
				<div>
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Código
					</dt>
					<dd className="font-mono text-gray-900">{modelo.codigo}</dd>
				</div>
				<div>
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Status
					</dt>
					<dd
						className={
							modelo.ativo
								? "text-green-700 font-medium"
								: "text-red-600 font-medium"
						}
					>
						{modelo.ativo ? "Ativo" : "Inativo"}
					</dd>
				</div>
				<div className="col-span-2">
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Nome
					</dt>
					<dd className="text-gray-900">{modelo.nome}</dd>
				</div>
				{modelo.descricao && (
					<div className="col-span-2">
						<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
							Descrição
						</dt>
						<dd className="text-gray-700">{modelo.descricao}</dd>
					</div>
				)}
				<div>
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Custo de produção
					</dt>
					<dd className="text-gray-900">{fmt(modelo.custo_producao)}</dd>
				</div>
				<div>
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Estoque mínimo
					</dt>
					<dd className="text-gray-900">{modelo.estoque_minimo ?? 0} un.</dd>
				</div>
				<div>
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Varejo (≥1 un.)
					</dt>
					<dd className="text-gray-900 font-medium">
						{modelo.preco_unitario == null ? (
							<span className="text-gray-400">—</span>
						) : (
							fmt(modelo.preco_unitario)
						)}
					</dd>
				</div>
				<div>
					<dt className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">
						Atacado
						{modelo.qtd_minima_atacado != null && (
							<span className="ml-1 normal-case font-normal">
								(≥{modelo.qtd_minima_atacado} un.)
							</span>
						)}
					</dt>
					<dd className="text-gray-900 font-medium">
						{modelo.preco_atacado == null ? (
							<span className="text-gray-400">—</span>
						) : (
							fmt(modelo.preco_atacado)
						)}
					</dd>
				</div>
			</dl>

			<ProdutoModal
				open={editOpen}
				onClose={() => setEditOpen(false)}
				produto={{
					modelo_id: modelo.modelo_id,
					nome: modelo.nome,
					codigo: modelo.codigo,
					descricao: modelo.descricao,
					custo_producao: modelo.custo_producao,
					estoque_minimo: modelo.estoque_minimo,
					preco_unitario: modelo.preco_unitario,
					preco_atacado: modelo.preco_atacado,
					qtd_minima_atacado: modelo.qtd_minima_atacado,
				}}
			/>

			{ultimoCalculo &&
				(() => {
					const h = Math.floor(ultimoCalculo.tempo_impressao_min / 60);
					const m = Math.round(ultimoCalculo.tempo_impressao_min % 60);
					const tempoStr = h > 0 ? `${h}h ${m}min` : `${m}min`;
					const data = new Date(ultimoCalculo.created_at).toLocaleString(
						"pt-BR",
						{
							day: "2-digit",
							month: "2-digit",
							year: "numeric",
							hour: "2-digit",
							minute: "2-digit",
						}
					);
					const placas = ultimoCalculo.num_placas ?? 1;
					const pctFalhas = (ultimoCalculo.pct_falhas * 100).toFixed(0);
					return (
						<div className="bg-[#F4F8FD] rounded-xl border border-[#B5D4F4] p-5 flex flex-col gap-3 mt-2">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
									Último cálculo vinculado
								</h3>
								<div className="flex items-center gap-2">
									<span className="text-xs text-gray-400">{data}</span>
									<Button
										size="sm"
										variant="secondary"
										onClick={preencherCalculadora}
									>
										Preencher calculadora
									</Button>
								</div>
							</div>

							<dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
								<div>
									<dt className="text-gray-500 text-xs mb-0.5">Equipamento</dt>
									<dd className="text-gray-900">
										{ultimoCalculo.config_equipamento?.nome ?? "—"}
									</dd>
								</div>
								<div>
									<dt className="text-gray-500 text-xs mb-0.5">
										Tempo de impressão
									</dt>
									<dd className="text-gray-900">{tempoStr}</dd>
								</div>
								<div>
									<dt className="text-gray-500 text-xs mb-0.5">Placas</dt>
									<dd className="text-gray-900">{placas}</dd>
								</div>
								<div>
									<dt className="text-gray-500 text-xs mb-0.5">Qtd total</dt>
									<dd className="text-gray-900">
										{ultimoCalculo.quantidade} un.
									</dd>
								</div>
								<div>
									<dt className="text-gray-500 text-xs mb-0.5">
										Média de falhas
									</dt>
									<dd className="text-gray-900">{pctFalhas}%</dd>
								</div>
							</dl>

							<table className="w-full text-xs border-t border-[#B5D4F4] pt-1 mt-1">
								<tbody>
									{[
										["Energia", ultimoCalculo.custo_energia],
										["Matéria-prima", ultimoCalculo.custo_materias_primas],
										["Depreciação", ultimoCalculo.custo_depreciacao],
										["Falhas", ultimoCalculo.custo_falhas],
										...(ultimoCalculo.custo_extra != null &&
										ultimoCalculo.custo_extra > 0
											? [["Custo extra", ultimoCalculo.custo_extra] as const]
											: []),
									].map(([label, valor]) => (
										<tr
											key={label as string}
											className="border-b border-[#E6F1FB] last:border-0"
										>
											<td className="py-1 text-gray-500">{label}</td>
											<td className="py-1 text-right text-gray-700">
												{fmt(valor as number)}
											</td>
										</tr>
									))}
									<tr className="border-t border-[#B5D4F4]">
										<td className="py-1.5 font-semibold text-gray-800">
											Total lote
										</td>
										<td className="py-1.5 text-right font-semibold text-gray-900">
											{fmt(ultimoCalculo.custo_total)}
										</td>
									</tr>
									<tr>
										<td className="py-1 font-semibold text-[#185FA5]">
											Por unidade
										</td>
										<td className="py-1 text-right font-bold text-[#185FA5]">
											{fmt(ultimoCalculo.custo_unitario)}
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					);
				})()}
		</div>
	);
}
