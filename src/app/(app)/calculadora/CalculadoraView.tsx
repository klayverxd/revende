"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select, useToast } from "@/components/ui";
import {
	salvarCalculo,
	salvarComoNovoProduto,
	atualizarCustoProduto,
	type MateriaInput,
} from "./actions";

export interface EquipamentoAtivo {
	equipamento_id: string;
	nome: string;
	potencia_watts: number;
	depreciacao_hora: number;
}

export interface MateriaPrimaAtiva {
	materia_prima_id: string;
	nome: string;
	preco_por_unidade: number;
	unidade_medida: string;
}

export interface ModeloOption {
	modelo_id: string;
	nome: string;
	codigo: string;
}

interface Props {
	readonly precoKwh: number;
	readonly equipamentos: EquipamentoAtivo[];
	readonly materias: MateriaPrimaAtiva[];
	readonly modelos: ModeloOption[];
}

interface MateriaUso extends MateriaInput {
	nome: string;
	unidade: string;
	preco_unit: number;
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hintMateria(unidade: string | undefined) {
	if (unidade === "kg") return "em gramas — ex: 120";
	if (unidade === "litro") return "em ml — ex: 50";
	return undefined;
}

function labelMateria(unidade: string | undefined) {
	if (unidade === "kg") return "Quantidade (g)";
	if (unidade === "litro") return "Quantidade (ml)";
	return "Quantidade";
}

/** Converte o valor digitado pelo usuário para a unidade interna (kg / litro) */
function converterParaUnidadeInterna(
	valor: number,
	unidade: string | undefined
): number {
	if (unidade === "kg") return valor / 1000;
	if (unidade === "litro") return valor / 1000;
	return valor;
}

export default function CalculadoraView({
	precoKwh,
	equipamentos,
	materias,
	modelos,
}: Props) {
	const { showToast } = useToast();
	const [equipamentoId, setEquipamentoId] = useState(
		equipamentos[0]?.equipamento_id ?? ""
	);
	const [tempoHInput, setTempoHInput] = useState("0");
	const [tempoMInput, setTempoMInput] = useState("0");
	const [pctFalhas, setPctFalhas] = useState("5");
	const [quantidade, setQuantidade] = useState("1");
	const [materiaId, setMateriaId] = useState(
		materias[0]?.materia_prima_id ?? ""
	);
	const [materiaQtd, setMateriaQtd] = useState("0");
	const [materiasUso, setMateriasUso] = useState<MateriaUso[]>([]);
	const [salvando, setSalvando] = useState(false);
	const [novoNome, setNovoNome] = useState("");
	const [modeloExistente, setModeloExistente] = useState("");

	const equip = equipamentos.find(e => e.equipamento_id === equipamentoId);
	const selectedMat = materias.find(m => m.materia_prima_id === materiaId);
	const tempoHoras =
		(Number.parseFloat(tempoHInput.replace(",", ".")) || 0) +
		(Number.parseFloat(tempoMInput.replace(",", ".")) || 0) / 60;
	const qtd = Number.parseFloat(quantidade.replace(",", ".")) || 0;
	const falhas = (Number.parseFloat(pctFalhas.replace(",", ".")) || 0) / 100;

	const custoMateriasPrimas = useMemo(
		() => materiasUso.reduce((acc, m) => acc + m.quantidade * m.preco_unit, 0),
		[materiasUso]
	);

	const custoEnergia =
		((equip?.potencia_watts ?? 0) / 1000) * precoKwh * tempoHoras;
	const custoDepreciacao = (equip?.depreciacao_hora ?? 0) * tempoHoras;
	const custoBase = custoMateriasPrimas + custoEnergia + custoDepreciacao;
	const custoFalhas = custoBase * falhas;
	const custoTotalLote = custoBase + custoFalhas;
	const custoUnitario = qtd > 0 ? custoTotalLote / qtd : 0;

	const sugestoes = [
		{ label: "2.5x", valor: custoUnitario * 2.5 },
		{ label: "3x", valor: custoUnitario * 3 },
		{ label: "4x", valor: custoUnitario * 4 },
	];

	function adicionarMateria() {
		const m = materias.find(x => x.materia_prima_id === materiaId);
		const qDigitada = Number.parseFloat(materiaQtd.replace(",", "."));
		if (!m || !Number.isFinite(qDigitada) || qDigitada <= 0) {
			showToast("Selecione matéria-prima e quantidade válida", "error");
			return;
		}
		const q = converterParaUnidadeInterna(qDigitada, m.unidade_medida);
		setMateriasUso(prev => {
			const idx = prev.findIndex(
				p => p.materia_prima_id === m.materia_prima_id
			);
			if (idx >= 0) {
				const next = [...prev];
				next[idx] = { ...next[idx], quantidade: next[idx].quantidade + q };
				return next;
			}
			return [
				...prev,
				{
					materia_prima_id: m.materia_prima_id,
					quantidade: q,
					nome: m.nome,
					unidade: m.unidade_medida,
					preco_unit: m.preco_por_unidade,
				},
			];
		});
		setMateriaQtd("0");
	}

	async function salvar(salvoEmModeloId?: string | null) {
		if (!equipamentoId || materiasUso.length === 0 || qtd <= 0) {
			showToast("Preencha os dados da simulação", "error");
			return;
		}
		setSalvando(true);
		try {
			await salvarCalculo({
				equipamento_id: equipamentoId,
				tempo_impressao_min: Math.round(tempoHoras * 60),
				materias_primas: materiasUso.map(m => ({
					materia_prima_id: m.materia_prima_id,
					quantidade: m.quantidade,
				})),
				pct_falhas: Number(falhas.toFixed(4)),
				custo_energia: Number(custoEnergia.toFixed(4)),
				custo_materias_primas: Number(custoMateriasPrimas.toFixed(4)),
				custo_depreciacao: Number(custoDepreciacao.toFixed(4)),
				custo_falhas: Number(custoFalhas.toFixed(4)),
				custo_total: Number(custoTotalLote.toFixed(4)),
				quantidade: qtd,
				custo_unitario: Number(custoUnitario.toFixed(4)),
				salvo_em_modelo_id: salvoEmModeloId ?? null,
			});
			showToast("Cálculo salvo", "success");
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao salvar cálculo",
				"error"
			);
		} finally {
			setSalvando(false);
		}
	}

	async function salvarNovoProduto() {
		if (!novoNome.trim()) {
			showToast("Informe o nome do novo produto", "error");
			return;
		}
		setSalvando(true);
		try {
			const result = await salvarComoNovoProduto({
				nome: novoNome.trim(),
				custo_producao: Number(custoUnitario.toFixed(4)),
			});
			await salvar(result.modelo_id);
			setNovoNome("");
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao salvar novo produto",
				"error"
			);
		} finally {
			setSalvando(false);
		}
	}

	async function atualizarProdutoExistente() {
		if (!modeloExistente) {
			showToast("Selecione um produto", "error");
			return;
		}
		setSalvando(true);
		try {
			await atualizarCustoProduto(
				modeloExistente,
				Number(custoUnitario.toFixed(4))
			);
			await salvar(modeloExistente);
			showToast("Custo do produto atualizado", "success");
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao atualizar produto",
				"error"
			);
		} finally {
			setSalvando(false);
		}
	}

	function removerMateria(id: string) {
		setMateriasUso(prev => prev.filter(x => x.materia_prima_id !== id));
	}

	return (
		<div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
			<div className="xl:col-span-2 rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
				<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
					<div className="col-span-2 md:col-span-1">
						<Select
							label="Equipamento"
							value={equipamentoId}
							onChange={e => setEquipamentoId(e.target.value)}
							options={equipamentos.map(e => ({
								value: e.equipamento_id,
								label: e.nome,
							}))}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<span className="text-[13px] text-gray-700 font-medium">
							Tempo de impressão
						</span>
						<div className="flex items-center gap-1">
							<input
								type="text"
								inputMode="numeric"
								min={0}
								value={tempoHInput}
								onChange={e => setTempoHInput(e.target.value)}
								className="w-12 rounded-lg border border-[#B5D4F4] px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#378ADD]"
							/>
							<span className="text-sm text-gray-600 select-none">h</span>
							<input
								type="text"
								inputMode="numeric"
								min={0}
								max={59}
								value={tempoMInput}
								onChange={e => setTempoMInput(e.target.value)}
								className="w-12 rounded-lg border border-[#B5D4F4] px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#378ADD]"
							/>
							<span className="text-sm text-gray-600 select-none">min</span>
						</div>
					</div>
					<Input
						label="Unidades no lote"
						type="number"
						min={1}
						hint="peças que saem nessa remessa"
						value={quantidade}
						onChange={e => setQuantidade(e.target.value)}
					/>
					<Input
						label="% de falhas"
						type="number"
						step="0.1"
						hint="peças descartadas por erro"
						value={pctFalhas}
						onChange={e => setPctFalhas(e.target.value)}
					/>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
					<div className="md:col-span-2">
						<Select
							label="Matéria-prima"
							value={materiaId}
							onChange={e => setMateriaId(e.target.value)}
							options={materias.map(m => ({
								value: m.materia_prima_id,
								label: `${m.nome} (${m.unidade_medida})`,
							}))}
						/>
					</div>
					<Input
						label={labelMateria(selectedMat?.unidade_medida)}
						type="number"
						step="1"
						hint={hintMateria(selectedMat?.unidade_medida)}
						value={materiaQtd}
						onChange={e => setMateriaQtd(e.target.value)}
					/>
					<Button onClick={adicionarMateria}>Adicionar</Button>
				</div>

				<div className="rounded-lg border border-[#B5D4F4] overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="bg-[#F4F8FD] border-b border-[#B5D4F4]">
								<th className="px-3 py-2 text-left">Item</th>
								<th className="px-3 py-2 text-right">Qtd</th>
								<th className="px-3 py-2 text-left">Unidade</th>
								<th className="px-3 py-2 text-right">Subtotal</th>
								<th className="px-3 py-2 text-right">Ação</th>
							</tr>
						</thead>
						<tbody>
							{materiasUso.length === 0 && (
								<tr>
									<td
										colSpan={5}
										className="px-3 py-6 text-center text-gray-600"
									>
										Nenhum insumo adicionado.
									</td>
								</tr>
							)}
							{materiasUso.map(m => {
								function fmtQtd() {
									if (m.unidade === "kg")
										return `${(m.quantidade * 1000).toLocaleString("pt-BR")} g`;
									if (m.unidade === "litro")
										return `${(m.quantidade * 1000).toLocaleString("pt-BR")} ml`;
									return String(m.quantidade);
								}
								return (
									<tr
										key={m.materia_prima_id}
										className="border-b border-[#B5D4F4] last:border-0"
									>
										<td className="px-3 py-2 text-gray-900">{m.nome}</td>
										<td className="px-3 py-2 text-right text-gray-700">
											{fmtQtd()}
										</td>
										<td className="px-3 py-2 text-gray-700">{m.unidade}</td>
										<td className="px-3 py-2 text-right text-gray-700">
											{fmtCurrency(m.quantidade * m.preco_unit)}
										</td>
										<td className="px-3 py-2 text-right">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => removerMateria(m.materia_prima_id)}
											>
												Remover
											</Button>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>

				<div className="flex justify-end">
					<Button
						loading={salvando}
						variant="secondary"
						onClick={() => salvar()}
					>
						Salvar cálculo
					</Button>
				</div>
			</div>

			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<h2 className="text-sm font-semibold text-gray-900">Resumo</h2>
				<p className="text-sm text-gray-700">
					Energia: <strong>{fmtCurrency(custoEnergia)}</strong>
				</p>
				<p className="text-sm text-gray-700">
					Matérias-primas: <strong>{fmtCurrency(custoMateriasPrimas)}</strong>
				</p>
				<p className="text-sm text-gray-700">
					Depreciação: <strong>{fmtCurrency(custoDepreciacao)}</strong>
				</p>
				<p className="text-sm text-gray-700">
					Falhas: <strong>{fmtCurrency(custoFalhas)}</strong>
				</p>
				<p className="text-sm text-gray-900">
					Custo total do lote: <strong>{fmtCurrency(custoTotalLote)}</strong>
				</p>
				<p className="text-base text-gray-900">
					Custo por unidade: <strong>{fmtCurrency(custoUnitario)}</strong>
				</p>

				<div className="rounded-lg border border-[#B5D4F4] bg-[#F4F8FD] p-3">
					<p className="text-xs uppercase tracking-wide text-gray-600">
						Sugestões de preço
					</p>
					<ul className="mt-2 space-y-1">
						{sugestoes.map(s => (
							<li
								key={s.label}
								className="flex items-center justify-between text-sm text-gray-800"
							>
								<span>{s.label}</span>
								<strong>{fmtCurrency(s.valor)}</strong>
							</li>
						))}
					</ul>
				</div>

				<div className="border-t border-[#B5D4F4] pt-3 flex flex-col gap-2">
					<p className="text-xs font-medium text-gray-700">
						Salvar como novo produto
					</p>
					<Input
						label="Nome do novo produto"
						value={novoNome}
						onChange={e => setNovoNome(e.target.value)}
					/>
					<Button loading={salvando} onClick={salvarNovoProduto}>
						Salvar como novo produto
					</Button>
				</div>

				<div className="border-t border-[#B5D4F4] pt-3 flex flex-col gap-2">
					<p className="text-xs font-medium text-gray-700">
						Atualizar produto existente
					</p>
					<Select
						label="Produto"
						value={modeloExistente}
						onChange={e => setModeloExistente(e.target.value)}
						options={[
							{ value: "", label: "Selecione..." },
							...modelos.map(m => ({
								value: m.modelo_id,
								label: `${m.codigo} - ${m.nome}`,
							})),
						]}
					/>
					<Button
						loading={salvando}
						variant="secondary"
						onClick={atualizarProdutoExistente}
					>
						Atualizar custo no produto
					</Button>
				</div>
			</div>
		</div>
	);
}
