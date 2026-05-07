"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input, Select, useToast } from "@/components/ui";
import {
	salvarComoNovoProduto,
	atualizarCustoProduto,
	type CalculoSnapshot,
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

export interface CustoExtraAtivo {
	custo_extra_id: string;
	nome: string;
	valor: number;
}

interface Props {
	readonly precoKwh: number;
	readonly pctFalhasPadrao: number;
	readonly equipamentos: EquipamentoAtivo[];
	readonly materias: MateriaPrimaAtiva[];
	readonly modelos: ModeloOption[];
	readonly custosExtras: CustoExtraAtivo[];
}

const LS_KEY = "calculadora_state";
const LOAD_KEY = "calculadora_load";

interface LoadState {
	equipamento_id: string;
	tempo_impressao_min: number;
	num_placas: number;
	quantidade_total: number;
	materia_prima_id: string;
	materia_qtd_internal: number;
	custo_extra_id: string | null;
	custo_extra_unitario: number;
}

interface PersistedState {
	equipamentoId: string;
	tempoHInput: string;
	tempoMInput: string;
	quantidade: string;
	numPlacas: string;
	materiaId: string;
	materiaQtd: string;
	custoExtraId: string;
	custoExtraVal: string;
}

function loadState(): Partial<PersistedState> {
	if (globalThis.window === undefined) return {};
	try {
		const raw = localStorage.getItem(LS_KEY);
		return raw ? (JSON.parse(raw) as Partial<PersistedState>) : {};
	} catch {
		return {};
	}
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function hintMateria() {
	return "Peso total da placa em gramas — ex: 364";
}

function labelMateria() {
	return "Peso (g)";
}

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
	pctFalhasPadrao,
	equipamentos,
	materias,
	modelos,
	custosExtras,
}: Props) {
	const { showToast } = useToast();
	const saved = useMemo(() => loadState(), []);

	const [equipamentoId, setEquipamentoId] = useState(() => {
		const savedId = saved.equipamentoId;
		const exists =
			savedId && equipamentos.some(e => e.equipamento_id === savedId);
		return exists ? savedId : (equipamentos[0]?.equipamento_id ?? "");
	});
	const [tempoHInput, setTempoHInput] = useState(saved.tempoHInput ?? "0");
	const [tempoMInput, setTempoMInput] = useState(saved.tempoMInput ?? "0");
	const [quantidade, setQuantidade] = useState(saved.quantidade ?? "1");
	const [numPlacas, setnumPlacas] = useState(saved.numPlacas ?? "1");
	const [materiaId, setMateriaId] = useState(() => {
		const savedId = saved.materiaId;
		const exists =
			savedId && materias.some(m => m.materia_prima_id === savedId);
		return exists ? savedId : (materias[0]?.materia_prima_id ?? "");
	});
	const [materiaQtd, setMateriaQtd] = useState(saved.materiaQtd ?? "0");
	const [custoExtraId, setCustoExtraId] = useState(saved.custoExtraId ?? "");
	const [custoExtraVal, setCustoExtraVal] = useState(
		saved.custoExtraVal ?? "0"
	);
	const [salvando, setSalvando] = useState(false);
	const [novoNome, setNovoNome] = useState("");
	const [modeloExistente, setModeloExistente] = useState("");
	const [lucroCustom, setLucroCustom] = useState("");

	// Carrega calculo gravado de outro local (ex: página de produto)
	useEffect(() => {
		if (globalThis.window === undefined) return;
		const raw = localStorage.getItem(LOAD_KEY);
		if (!raw) return;
		localStorage.removeItem(LOAD_KEY);
		try {
			const load = JSON.parse(raw) as LoadState;
			if (load.equipamento_id) setEquipamentoId(load.equipamento_id);
			const h = Math.floor(load.tempo_impressao_min / 60);
			const m = Math.round(load.tempo_impressao_min % 60);
			setTempoHInput(String(h));
			setTempoMInput(String(m));
			const placas = Math.max(1, load.num_placas);
			setnumPlacas(String(placas));
			const qtdPorPlaca =
				load.quantidade_total > 0 ? load.quantidade_total / placas : 1;
			setQuantidade(String(qtdPorPlaca));
			if (load.materia_prima_id) {
				setMateriaId(load.materia_prima_id);
				const mat = materias.find(
					m => m.materia_prima_id === load.materia_prima_id
				);
				const displayQtd =
					mat?.unidade_medida === "kg" || mat?.unidade_medida === "litro"
						? load.materia_qtd_internal * 1000
						: load.materia_qtd_internal;
				setMateriaQtd(String(Number(displayQtd.toFixed(4))));
			}
			if (load.custo_extra_id) {
				setCustoExtraId(load.custo_extra_id);
				setCustoExtraVal(String(Number(load.custo_extra_unitario.toFixed(4))));
			}
		} catch {
			// ignora parse error
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Persiste estado no localStorage sempre que mudar
	useEffect(() => {
		const state: PersistedState = {
			equipamentoId,
			tempoHInput,
			tempoMInput,
			quantidade,
			numPlacas,
			materiaId,
			materiaQtd,
			custoExtraId,
			custoExtraVal,
		};
		localStorage.setItem(LS_KEY, JSON.stringify(state));
	}, [
		equipamentoId,
		tempoHInput,
		tempoMInput,
		quantidade,
		numPlacas,
		materiaId,
		materiaQtd,
		custoExtraId,
		custoExtraVal,
	]);

	const equip = equipamentos.find(e => e.equipamento_id === equipamentoId);
	const selectedMat = materias.find(m => m.materia_prima_id === materiaId);
	const tempoHoras =
		(Number.parseFloat(tempoHInput.replace(",", ".")) || 0) +
		(Number.parseFloat(tempoMInput.replace(",", ".")) || 0) / 60;
	const qtdPorPlaca = Number.parseFloat(quantidade.replace(",", ".")) || 0;
	const placas = Math.max(
		1,
		Number.parseFloat(numPlacas.replace(",", ".")) || 1
	);
	const falhas = pctFalhasPadrao;

	const qtdMateriaInterna = converterParaUnidadeInterna(
		Number.parseFloat(materiaQtd.replace(",", ".")) || 0,
		selectedMat?.unidade_medida
	);
	const custoMateriasPrimas =
		qtdMateriaInterna * (selectedMat?.preco_por_unidade ?? 0);

	const custoEnergia =
		((equip?.potencia_watts ?? 0) / 1000) * precoKwh * tempoHoras;
	const custoDepreciacao = (equip?.depreciacao_hora ?? 0) * tempoHoras;
	const custoBase = custoMateriasPrimas + custoEnergia + custoDepreciacao;
	const custoFalhas = custoMateriasPrimas * falhas;
	const custoExtraUnitario =
		Number.parseFloat(custoExtraVal.replace(",", ".")) || 0;
	const custoExtraPlaca = custoExtraUnitario * qtdPorPlaca;
	const custoTotalPlaca = custoBase + custoFalhas + custoExtraPlaca;
	const custoTotalGeral = custoTotalPlaca * placas;
	const qtdTotal = qtdPorPlaca * placas;
	const custoUnitario = qtdTotal > 0 ? custoTotalGeral / qtdTotal : 0;

	const LUCROS_PADRAO = [50, 100, 150, 200, 300, 400, 500];
	const lucroCustomPct = Number.parseFloat(lucroCustom.replace(",", ".")) || 0;

	async function salvarNovoProduto() {
		if (!novoNome.trim()) {
			showToast("Informe o nome do novo produto", "error");
			return;
		}
		const calculo: CalculoSnapshot = {
			equipamento_id: equipamentoId,
			tempo_impressao_min: tempoHoras * 60,
			materias_primas: materiaId
				? [{ materia_prima_id: materiaId, quantidade: qtdMateriaInterna }]
				: [],
			pct_falhas: falhas,
			custo_energia: Number(custoEnergia.toFixed(4)),
			custo_materias_primas: Number(custoMateriasPrimas.toFixed(4)),
			custo_depreciacao: Number(custoDepreciacao.toFixed(4)),
			custo_falhas: Number(custoFalhas.toFixed(4)),
			custo_extra: Number((custoExtraPlaca * placas).toFixed(4)),
			custo_total: Number(custoTotalGeral.toFixed(4)),
			quantidade: qtdTotal,
			num_placas: placas,
			custo_unitario: Number(custoUnitario.toFixed(4)),
			custo_extra_id: custoExtraId || null,
		};
		setSalvando(true);
		try {
			await salvarComoNovoProduto({
				nome: novoNome.trim(),
				custo_producao: Number(custoUnitario.toFixed(4)),
				calculo,
			});
			setNovoNome("");
			showToast("Produto criado com custo atualizado", "success");
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
		const calculo: CalculoSnapshot = {
			equipamento_id: equipamentoId,
			tempo_impressao_min: tempoHoras * 60,
			materias_primas: materiaId
				? [{ materia_prima_id: materiaId, quantidade: qtdMateriaInterna }]
				: [],
			pct_falhas: falhas,
			custo_energia: Number(custoEnergia.toFixed(4)),
			custo_materias_primas: Number(custoMateriasPrimas.toFixed(4)),
			custo_depreciacao: Number(custoDepreciacao.toFixed(4)),
			custo_falhas: Number(custoFalhas.toFixed(4)),
			custo_extra: Number((custoExtraPlaca * placas).toFixed(4)),
			custo_total: Number(custoTotalGeral.toFixed(4)),
			quantidade: qtdTotal,
			num_placas: placas,
			custo_unitario: Number(custoUnitario.toFixed(4)),
			custo_extra_id: custoExtraId || null,
		};
		setSalvando(true);
		try {
			await atualizarCustoProduto(
				modeloExistente,
				Number(custoUnitario.toFixed(4)),
				calculo
			);
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

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_260px] gap-4 items-start w-fit max-w-full">
			{/* Coluna esquerda — inputs */}
			<div className="flex flex-col gap-4">
				{/* Bloco: Impressão */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Impressão
					</h2>

					<div className="flex flex-wrap items-end gap-3">
						<div className="w-48 shrink-0">
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
						<div className="flex flex-col gap-1 shrink-0">
							<span className="text-[13px] text-gray-700 font-medium">
								Tempo
							</span>
							<div className="flex items-center gap-1">
								<input
									type="text"
									inputMode="numeric"
									min={0}
									value={tempoHInput}
									onChange={e => setTempoHInput(e.target.value)}
									className="w-14 rounded-lg border border-[#B5D4F4] px-2 py-2 text-base font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[#378ADD]"
								/>
								<span className="text-sm text-gray-600 select-none">h</span>
								<input
									type="text"
									inputMode="numeric"
									min={0}
									max={59}
									value={tempoMInput}
									onChange={e => setTempoMInput(e.target.value)}
									className="w-14 rounded-lg border border-[#B5D4F4] px-2 py-2 text-base font-semibold text-center focus:outline-none focus:ring-2 focus:ring-[#378ADD]"
								/>
								<span className="text-sm text-gray-600 select-none">min</span>
							</div>
						</div>
						<div className="w-24 shrink-0">
							<Input
								label="Nº de placas"
								type="number"
								min={1}
								tooltip="Quantas placas você vai produzir. Ex: 10 peças, 5 por placa = 2 placas"
								value={numPlacas}
								onChange={e => setnumPlacas(e.target.value)}
							/>
						</div>
					</div>
				</div>

				{/* Bloco: Material */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Material
					</h2>

					<div className="flex flex-wrap items-end gap-3">
						<div className="w-44 shrink-0">
							<Select
								label="Matéria-prima"
								value={materiaId}
								onChange={e => setMateriaId(e.target.value)}
								options={materias.map(m => ({
									value: m.materia_prima_id,
									label: m.nome,
								}))}
							/>
						</div>
						<div className="w-28 shrink-0">
							<Input
								label={labelMateria()}
								type="number"
								step="1"
								tooltip={hintMateria()}
								value={materiaQtd}
								onChange={e => setMateriaQtd(e.target.value)}
							/>
						</div>
						<div className="w-24 shrink-0">
							<Input
								label="Unidades/placa"
								type="number"
								min={1}
								tooltip="Quantas peças saem de uma única placa de impressão"
								value={quantidade}
								onChange={e => setQuantidade(e.target.value)}
							/>
						</div>
					</div>
				</div>

				{/* Bloco: Custo extra */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Custo extra
					</h2>

					<div className="flex flex-wrap items-end gap-3">
						<div className="w-48 shrink-0">
							<Select
								label="Catálogo"
								value={custoExtraId}
								onChange={e => {
									const id = e.target.value;
									setCustoExtraId(id);
									const item = custosExtras.find(x => x.custo_extra_id === id);
									if (item) setCustoExtraVal(String(item.valor));
									else if (!id) setCustoExtraVal("0");
								}}
								options={[
									{ value: "", label: "Nenhum" },
									...custosExtras.map(x => ({
										value: x.custo_extra_id,
										label: x.nome,
									})),
								]}
							/>
						</div>
						<div className="w-36 shrink-0">
							<Input
								label="Valor por peça (R$)"
								type="number"
								step="0.01"
								tooltip="Custo adicional por peça (argola, embalagem etc.). Edite livremente."
								value={custoExtraVal}
								onChange={e => setCustoExtraVal(e.target.value)}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Coluna direita — resumo + sugestões + salvar */}
			<div className="flex flex-col gap-4">
				{/* Bloco: Resumo de custos */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-2">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] mb-1">
						Resumo
					</h2>

					{(() => {
						let resumoLote: string;
						if (placas > 1) {
							resumoLote = `${placas} placas × ${qtdPorPlaca} un. = ${qtdTotal} peças`;
						} else if (qtdPorPlaca === 1) {
							resumoLote = "1 peça (1 lote)";
						} else {
							resumoLote = `${qtdPorPlaca} peças (1 lote)`;
						}
						return (
							<div className="text-xs text-gray-500 bg-[#F4F8FD] rounded-lg px-3 py-2 mb-1">
								{resumoLote}
							</div>
						);
					})()}

					<div className="flex justify-between text-sm text-gray-600">
						<span>Energia</span>
						<strong className="text-gray-800">
							{fmtCurrency(custoEnergia)}
						</strong>
					</div>
					<div className="flex justify-between text-sm text-gray-600">
						<span>Matéria-prima</span>
						<strong className="text-gray-800">
							{fmtCurrency(custoMateriasPrimas)}
						</strong>
					</div>
					<div className="flex justify-between text-sm text-gray-600">
						<span>Depreciação</span>
						<strong className="text-gray-800">
							{fmtCurrency(custoDepreciacao)}
						</strong>
					</div>
					<div className="flex justify-between text-sm text-gray-600">
						<span>Falhas</span>
						<strong className="text-gray-800">
							{fmtCurrency(custoFalhas)}
						</strong>
					</div>
					{custoExtraPlaca > 0 && (
						<div className="flex justify-between text-sm text-gray-600">
							<span>Custo extra</span>
							<strong className="text-gray-800">
								{fmtCurrency(custoExtraPlaca)}
							</strong>
						</div>
					)}
					<div className="flex justify-between text-sm text-gray-600 border-t border-[#B5D4F4] pt-2 mt-1">
						<span>1 placa</span>
						<strong className="text-gray-800">
							{fmtCurrency(custoTotalPlaca)}
						</strong>
					</div>
					{placas > 1 && (
						<div className="flex justify-between text-sm text-gray-600">
							<span>{placas} placas</span>
							<strong className="text-gray-800">
								{fmtCurrency(custoTotalGeral)}
							</strong>
						</div>
					)}
					<div className="flex justify-between items-baseline border-t border-[#B5D4F4] pt-2 mt-1">
						<span className="text-sm font-semibold text-gray-900">
							Por unidade
						</span>
						<strong className="text-lg text-[#185FA5]">
							{fmtCurrency(custoUnitario)}
						</strong>
					</div>
				</div>

				{/* Bloco: Sugestões de preço */}
				<div className="rounded-xl border border-[#B5D4F4] bg-[#F4F8FD] p-4 flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Sugestões de preço
					</h2>

					{/* Input de lucro personalizado */}
					<div className="flex items-end gap-1">
						<div className="flex-1">
							<Input
								label="Lucro personalizado (%)"
								type="number"
								min={0}
								max={9999}
								placeholder="ex: 250"
								value={lucroCustom}
								onChange={e => setLucroCustom(e.target.value)}
							/>
						</div>
					</div>
					{lucroCustomPct > 0 && custoUnitario > 0 && (
						<div className="rounded-lg bg-white border border-[#185FA5] px-3 py-2 flex justify-between items-center">
							<span className="text-xs text-gray-600">
								{lucroCustomPct}% de lucro
							</span>
							<strong className="text-[#185FA5] text-sm">
								{fmtCurrency(custoUnitario * (1 + lucroCustomPct / 100))}
							</strong>
						</div>
					)}

					{/* Tabela fixa */}
					<table className="w-full text-xs">
						<thead>
							<tr className="border-b border-[#B5D4F4]">
								<th className="pb-1 text-left font-medium text-gray-500">
									Lucro
								</th>
								<th className="pb-1 text-right font-medium text-gray-500">
									Preço
								</th>
								<th className="pb-1 text-right font-medium text-gray-500">
									Ganho
								</th>
							</tr>
						</thead>
						<tbody>
							{LUCROS_PADRAO.map(pct => (
								<tr
									key={pct}
									className="border-b border-[#E6F1FB] last:border-0"
								>
									<td className="py-1 text-gray-600 font-medium">{pct}%</td>
									<td className="py-1 text-right font-semibold text-gray-900">
										{custoUnitario > 0
											? fmtCurrency(custoUnitario * (1 + pct / 100))
											: "—"}
									</td>
									<td className="py-1 text-right text-green-700">
										{custoUnitario > 0
											? "+" + fmtCurrency((custoUnitario * pct) / 100)
											: "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Bloco: Salvar produto */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Salvar como produto
					</h2>
					<Input
						label="Nome do novo produto"
						value={novoNome}
						onChange={e => setNovoNome(e.target.value)}
					/>
					<Button loading={salvando} onClick={salvarNovoProduto}>
						Salvar como novo produto
					</Button>

					<div className="border-t border-[#B5D4F4] pt-3 flex flex-col gap-2">
						<p className="text-xs font-medium text-gray-600">
							Ou atualizar existente
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
		</div>
	);
}
