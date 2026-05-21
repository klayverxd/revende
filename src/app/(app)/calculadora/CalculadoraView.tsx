"use client";

import { useEffect, useState } from "react";
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

interface PlacaIndividual {
	id: string;
	tempoH: string;
	tempoM: string;
	peso: string;
	unidades: string;
}

type ModoPlacas = "igual" | "individual";

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
	modoPlacas?: ModoPlacas;
	placasInd?: PlacaIndividual[];
}

// Tabela oficial Shopee 2026
const SHOPEE_FAIXAS = [
	{ min: 0, max: 79.99, pct: 0.2, fixo: 4, label: "20% + R$ 4" },
	{ min: 80, max: 99.99, pct: 0.14, fixo: 16, label: "14% + R$16" },
	{ min: 100, max: 199.99, pct: 0.14, fixo: 20, label: "14% + R$20" },
	{ min: 200, max: 499.99, pct: 0.14, fixo: 26, label: "14% + R$26" },
	{ min: 500, max: Infinity, pct: 0.14, fixo: 26, label: "14% + R$26" },
] as const;

function calcShopee(targetNet: number): {
	preco: number;
	faixa: (typeof SHOPEE_FAIXAS)[number];
} | null {
	if (targetNet <= 0) return null;
	for (const faixa of SHOPEE_FAIXAS) {
		const preco = (targetNet + faixa.fixo) / (1 - faixa.pct);
		if (preco >= faixa.min && preco <= faixa.max + 0.005) {
			return { preco, faixa };
		}
	}
	const faixa = SHOPEE_FAIXAS.at(-1)!;
	return { preco: (targetNet + faixa.fixo) / (1 - faixa.pct), faixa };
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

function converterParaUnidadeInterna(
	valor: number,
	unidade: string | undefined
): number {
	if (unidade === "kg") return valor / 1000;
	if (unidade === "litro") return valor / 1000;
	return valor;
}

let _placaIdSeq = 0;
function newPlacaId() {
	return `pl_${++_placaIdSeq}`;
}

const PLACA_DEFAULT: Omit<PlacaIndividual, "id"> = {
	tempoH: "0",
	tempoM: "0",
	peso: "0",
	unidades: "1",
};

const inputCls =
	"rounded-lg border border-[#B5D4F4] px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#378ADD]";

export default function CalculadoraView({
	precoKwh,
	pctFalhasPadrao,
	equipamentos,
	materias,
	modelos,
	custosExtras,
}: Props) {
	const { showToast } = useToast();

	const [equipamentoId, setEquipamentoId] = useState(
		equipamentos[0]?.equipamento_id ?? ""
	);
	const [tempoHInput, setTempoHInput] = useState("0");
	const [tempoMInput, setTempoMInput] = useState("0");
	const [quantidade, setQuantidade] = useState("1");
	const [numPlacas, setnumPlacas] = useState("1");
	const [materiaId, setMateriaId] = useState(
		materias[0]?.materia_prima_id ?? ""
	);
	const [materiaQtd, setMateriaQtd] = useState("0");
	const [custoExtraId, setCustoExtraId] = useState("");
	const [custoExtraVal, setCustoExtraVal] = useState("0");
	const [modoPlacas, setModoPlacas] = useState<ModoPlacas>("igual");
	const [placasInd, setPlacasInd] = useState<PlacaIndividual[]>([
		{ id: newPlacaId(), ...PLACA_DEFAULT },
	]);

	// Restore persisted state after hydration
	useEffect(() => {
		const saved = loadState();
		if (saved.equipamentoId) {
			const exists = equipamentos.some(
				e => e.equipamento_id === saved.equipamentoId
			);
			if (exists) setEquipamentoId(saved.equipamentoId);
		}
		if (saved.tempoHInput !== undefined) setTempoHInput(saved.tempoHInput);
		if (saved.tempoMInput !== undefined) setTempoMInput(saved.tempoMInput);
		if (saved.quantidade !== undefined) setQuantidade(saved.quantidade);
		if (saved.numPlacas !== undefined) setnumPlacas(saved.numPlacas);
		if (saved.materiaId) {
			const exists = materias.some(m => m.materia_prima_id === saved.materiaId);
			if (exists) setMateriaId(saved.materiaId);
		}
		if (saved.materiaQtd !== undefined) setMateriaQtd(saved.materiaQtd);
		if (saved.custoExtraId !== undefined) setCustoExtraId(saved.custoExtraId);
		if (saved.custoExtraVal !== undefined)
			setCustoExtraVal(saved.custoExtraVal);
		if (saved.modoPlacas) setModoPlacas(saved.modoPlacas);
		if (
			saved.placasInd &&
			Array.isArray(saved.placasInd) &&
			saved.placasInd.length > 0
		) {
			setPlacasInd(saved.placasInd);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
			setModoPlacas("igual");
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
			modoPlacas,
			placasInd,
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
		modoPlacas,
		placasInd,
	]);

	// --- Helpers para placas individuais ---
	function addPlaca() {
		setPlacasInd(prev => [...prev, { id: newPlacaId(), ...PLACA_DEFAULT }]);
	}
	function removePlaca(id: string) {
		setPlacasInd(prev => (prev.length > 1 ? prev.filter(p => p.id !== id) : prev));
	}
	function updatePlaca(id: string, field: keyof Omit<PlacaIndividual, "id">, value: string) {
		setPlacasInd(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
	}

	const equip = equipamentos.find(e => e.equipamento_id === equipamentoId);
	const selectedMat = materias.find(m => m.materia_prima_id === materiaId);
	const falhas = pctFalhasPadrao;
	const isIndividual = modoPlacas === "individual";

	// === MODO IGUAL (por placa, depois × numPlacas) ===
	const tempoHoras =
		(Number.parseFloat(tempoHInput.replace(",", ".")) || 0) +
		(Number.parseFloat(tempoMInput.replace(",", ".")) || 0) / 60;
	const qtdPorPlaca = Number.parseFloat(quantidade.replace(",", ".")) || 0;
	const placas = Math.max(
		1,
		Number.parseFloat(numPlacas.replace(",", ".")) || 1
	);
	const qtdMateriaInterna = converterParaUnidadeInterna(
		Number.parseFloat(materiaQtd.replace(",", ".")) || 0,
		selectedMat?.unidade_medida
	);
	const custoMatIgual = qtdMateriaInterna * (selectedMat?.preco_por_unidade ?? 0);
	const custoEnergiaIgual = ((equip?.potencia_watts ?? 0) / 1000) * precoKwh * tempoHoras;
	const custoDeprecIgual = (equip?.depreciacao_hora ?? 0) * tempoHoras;
	const custoFalhasIgual = custoMatIgual * falhas;
	const custoTotalPlaca = custoMatIgual + custoEnergiaIgual + custoDeprecIgual + custoFalhasIgual;
	const qtdTotalIgual = qtdPorPlaca * placas;

	// === MODO INDIVIDUAL (soma de todas as placas) ===
	let custoMatInd = 0;
	let totalTempoHorasInd = 0;
	let qtdTotalInd = 0;
	for (const p of placasInd) {
		totalTempoHorasInd +=
			(Number.parseFloat(p.tempoH.replace(",", ".")) || 0) +
			(Number.parseFloat(p.tempoM.replace(",", ".")) || 0) / 60;
		custoMatInd +=
			converterParaUnidadeInterna(
				Number.parseFloat(p.peso.replace(",", ".")) || 0,
				selectedMat?.unidade_medida
			) * (selectedMat?.preco_por_unidade ?? 0);
		qtdTotalInd += Number.parseFloat(p.unidades.replace(",", ".")) || 0;
	}
	const custoEnergiaInd = ((equip?.potencia_watts ?? 0) / 1000) * precoKwh * totalTempoHorasInd;
	const custoDeprecInd = (equip?.depreciacao_hora ?? 0) * totalTempoHorasInd;
	const custoFalhasInd = custoMatInd * falhas;

	// === VALORES UNIFICADOS ===
	const custoMateriasPrimas = isIndividual ? custoMatInd : custoMatIgual;
	const custoEnergia = isIndividual ? custoEnergiaInd : custoEnergiaIgual;
	const custoDepreciacao = isIndividual ? custoDeprecInd : custoDeprecIgual;
	const custoFalhas = isIndividual ? custoFalhasInd : custoFalhasIgual;
	const custoExtraTotal = Number.parseFloat(custoExtraVal.replace(",", ".")) || 0;
	const qtdTotal = isIndividual ? qtdTotalInd : qtdTotalIgual;
	const numPlacasEff = isIndividual ? placasInd.length : placas;

	// Total geral: igual multiplica por placas; individual já tem tudo somado
	const custoTotalGeral = isIndividual
		? custoMatInd + custoEnergiaInd + custoDeprecInd + custoFalhasInd + custoExtraTotal
		: custoTotalPlaca * placas + custoExtraTotal;

	const custoUnitario = qtdTotal > 0 ? custoTotalGeral / qtdTotal : 0;

	const LUCROS_PADRAO = [50, 100, 150, 200, 300, 400, 500];
	const lucroCustomPct = Number.parseFloat(lucroCustom.replace(",", ".")) || 0;

	function buildSnapshot(): CalculoSnapshot {
		if (isIndividual) {
			const totalMateriaInterna = placasInd.reduce((s, p) => {
				return (
					s +
					converterParaUnidadeInterna(
						Number.parseFloat(p.peso.replace(",", ".")) || 0,
						selectedMat?.unidade_medida
					)
				);
			}, 0);
			return {
				equipamento_id: equipamentoId,
				tempo_impressao_min: Number((totalTempoHorasInd * 60).toFixed(2)),
				materias_primas: materiaId
					? [{ materia_prima_id: materiaId, quantidade: Number(totalMateriaInterna.toFixed(4)) }]
					: [],
				pct_falhas: falhas,
				custo_energia: Number(custoEnergiaInd.toFixed(4)),
				custo_materias_primas: Number(custoMatInd.toFixed(4)),
				custo_depreciacao: Number(custoDeprecInd.toFixed(4)),
				custo_falhas: Number(custoFalhasInd.toFixed(4)),
				custo_extra: Number(custoExtraTotal.toFixed(4)),
				custo_total: Number(custoTotalGeral.toFixed(4)),
				quantidade: qtdTotalInd,
				num_placas: placasInd.length,
				custo_unitario: Number(custoUnitario.toFixed(4)),
				custo_extra_id: custoExtraId || null,
			};
		}
		return {
			equipamento_id: equipamentoId,
			tempo_impressao_min: tempoHoras * 60,
			materias_primas: materiaId
				? [{ materia_prima_id: materiaId, quantidade: qtdMateriaInterna }]
				: [],
			pct_falhas: falhas,
			custo_energia: Number(custoEnergiaIgual.toFixed(4)),
			custo_materias_primas: Number(custoMatIgual.toFixed(4)),
			custo_depreciacao: Number(custoDeprecIgual.toFixed(4)),
			custo_falhas: Number(custoFalhasIgual.toFixed(4)),
			custo_extra: Number(custoExtraTotal.toFixed(4)),
			custo_total: Number(custoTotalGeral.toFixed(4)),
			quantidade: qtdTotalIgual,
			num_placas: placas,
			custo_unitario: Number(custoUnitario.toFixed(4)),
			custo_extra_id: custoExtraId || null,
		};
	}

	async function salvarNovoProduto() {
		if (!novoNome.trim()) {
			showToast("Informe o nome do novo produto", "error");
			return;
		}
		setSalvando(true);
		try {
			await salvarComoNovoProduto({
				nome: novoNome.trim(),
				custo_producao: Number(custoUnitario.toFixed(4)),
				calculo: buildSnapshot(),
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
		setSalvando(true);
		try {
			await atualizarCustoProduto(
				modeloExistente,
				Number(custoUnitario.toFixed(4)),
				buildSnapshot()
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
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start w-full">
			{/* Coluna esquerda — inputs */}
			<div className="flex flex-col gap-4">
				{/* Bloco: Impressão */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Impressão
					</h2>

					<div className="flex-1 min-w-45">
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

					{/* Toggle modo de placas */}
					<div className="flex gap-1 rounded-lg bg-[#F4F8FD] p-1">
						<button
							type="button"
							onClick={() => setModoPlacas("igual")}
							className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
								modoPlacas === "igual"
									? "bg-white text-[#185FA5] shadow-sm"
									: "text-gray-500 hover:text-gray-700"
							}`}
						>
							Placas iguais
						</button>
						<button
							type="button"
							onClick={() => setModoPlacas("individual")}
							className={`flex-1 text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
								modoPlacas === "individual"
									? "bg-white text-[#185FA5] shadow-sm"
									: "text-gray-500 hover:text-gray-700"
							}`}
						>
							Placas individuais
						</button>
					</div>

					{/* Modo: Placas iguais */}
					{modoPlacas === "igual" && (
						<div className="flex flex-wrap items-end gap-3">
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
					)}

					{/* Modo: Placas individuais */}
					{modoPlacas === "individual" && (
						<div className="flex flex-col gap-2">
							{/* Cabeçalho da tabela */}
							<div className="grid grid-cols-[1.2rem_1fr_5rem_4rem_1.5rem] gap-x-2 text-[11px] font-medium text-gray-400 px-0.5">
								<span>#</span>
								<span>Tempo</span>
								<span className="text-center">
									{selectedMat?.unidade_medida === "kg" ||
									selectedMat?.unidade_medida === "litro"
										? "Peso (g)"
										: "Qtd."}
								</span>
								<span className="text-center">Unid.</span>
								<span />
							</div>

							{placasInd.map((placa, idx) => (
								<div
									key={placa.id}
									className="grid grid-cols-[1.2rem_1fr_5rem_4rem_1.5rem] gap-x-2 items-center"
								>
									<span className="text-xs text-gray-400 select-none">
										{idx + 1}
									</span>

									{/* Tempo */}
									<div className="flex items-center gap-0.5">
										<input
											type="text"
											inputMode="numeric"
											value={placa.tempoH}
											onChange={e => updatePlaca(placa.id, "tempoH", e.target.value)}
											className={`${inputCls} w-9`}
										/>
										<span className="text-xs text-gray-500 select-none">h</span>
										<input
											type="text"
											inputMode="numeric"
											value={placa.tempoM}
											onChange={e => updatePlaca(placa.id, "tempoM", e.target.value)}
											className={`${inputCls} w-9`}
										/>
										<span className="text-xs text-gray-500 select-none">m</span>
									</div>

									{/* Peso */}
									<input
										type="number"
										step="1"
										value={placa.peso}
										onChange={e => updatePlaca(placa.id, "peso", e.target.value)}
										className={`${inputCls} w-full`}
									/>

									{/* Unidades */}
									<input
										type="number"
										min={1}
										step="1"
										value={placa.unidades}
										onChange={e => updatePlaca(placa.id, "unidades", e.target.value)}
										className={`${inputCls} w-full`}
									/>

									{/* Remover */}
									<button
										type="button"
										onClick={() => removePlaca(placa.id)}
										disabled={placasInd.length === 1}
										className="text-gray-400 hover:text-red-500 disabled:opacity-30 text-base leading-none transition-colors"
										title="Remover placa"
									>
										×
									</button>
								</div>
							))}

							<button
								type="button"
								onClick={addPlaca}
								className="mt-1 flex items-center gap-1 text-xs text-[#185FA5] hover:text-[#0C447C] font-medium transition-colors"
							>
								<span className="text-base leading-none">+</span> Adicionar placa
							</button>
						</div>
					)}
				</div>

				{/* Bloco: Material */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Material
					</h2>

					<div className="flex flex-wrap items-end gap-3">
						<div className="flex-1 min-w-40">
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

						{/* Em modo individual, peso e unidades ficam na tabela de placas */}
						{modoPlacas === "igual" && (
							<>
								<div className="w-28 shrink-0">
									<Input
										label="Peso (g)"
										type="number"
										step="1"
										tooltip="Peso total da placa em gramas — ex: 364"
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
							</>
						)}

						{modoPlacas === "individual" && (
							<p className="text-xs text-gray-400 italic">
								Peso e unidades definidos por placa na tabela acima.
							</p>
						)}
					</div>
				</div>

				{/* Bloco: Custo extra */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-4">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Custo extra
					</h2>

					<div className="flex flex-wrap items-end gap-3">
						<div className="flex-1 min-w-45">
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
								label="Valor total (R$)"
								type="number"
								step="0.01"
								tooltip="Custo operacional fixo do lote (frete, embalagens, consumíveis etc.). Não é multiplicado pela quantidade."
								value={custoExtraVal}
								onChange={e => setCustoExtraVal(e.target.value)}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* Coluna central — resumo + sugestões de preço */}
			<div className="flex flex-col gap-4">
				{/* Bloco: Resumo de custos */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-2">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5] mb-1">
						Resumo
					</h2>

					{(() => {
						let resumoLote: string;
						if (isIndividual) {
							resumoLote = `${numPlacasEff} placa${numPlacasEff !== 1 ? "s" : ""} individuais → ${qtdTotalInd} peças`;
						} else if (placas > 1) {
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

					{isIndividual && (
						<p className="text-[11px] text-gray-400 italic -mt-1 mb-1">
							Valores totais de todas as placas
						</p>
					)}

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
					{custoExtraTotal > 0 && (
						<div className="flex justify-between text-sm text-gray-600">
							<span>Custo extra (fixo)</span>
							<strong className="text-gray-800">
								{fmtCurrency(custoExtraTotal)}
							</strong>
						</div>
					)}

					{/* Subtotais: apenas em modo igual */}
					{!isIndividual && (
						<>
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
										{fmtCurrency(custoTotalPlaca * placas)}
									</strong>
								</div>
							)}
						</>
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
			</div>

			{/* Coluna direita — salvar */}
			<div className="flex flex-col gap-4">
				{/* Bloco: Preço na Shopee */}
				<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-wide text-[#185FA5]">
						Preço na Shopee
					</h2>

					{lucroCustomPct > 0 &&
						custoUnitario > 0 &&
						(() => {
							const r = calcShopee(custoUnitario * (1 + lucroCustomPct / 100));
							if (!r) return null;
							const lucroLiq =
								r.preco * (1 - r.faixa.pct) - r.faixa.fixo - custoUnitario;
							return (
								<div className="rounded-lg bg-[#F4F8FD] border border-[#185FA5] px-3 py-2 flex justify-between items-center gap-2">
									<span className="text-xs text-gray-600">
										{lucroCustomPct}% de lucro
										<span className="ml-1 text-gray-400">
											({r.faixa.label})
										</span>
									</span>
									<div className="text-right shrink-0">
										<strong className="text-[#185FA5] text-sm block">
											{fmtCurrency(r.preco)}
										</strong>
										<span className="text-[10px] text-green-700">
											+{fmtCurrency(lucroLiq)} líquido
										</span>
									</div>
								</div>
							);
						})()}

					<table className="w-full text-xs">
						<thead>
							<tr className="border-b border-[#B5D4F4]">
								<th className="pb-1 text-left font-medium text-gray-500">
									Lucro
								</th>
								<th className="pb-1 text-right font-medium text-gray-500">
									Anunciar por
								</th>
								<th className="pb-1 text-right font-medium text-gray-500">
									Líquido
								</th>
							</tr>
						</thead>
						<tbody>
							{LUCROS_PADRAO.map(pct => {
								if (custoUnitario <= 0) {
									return (
										<tr
											key={pct}
											className="border-b border-[#E6F1FB] last:border-0"
										>
											<td className="py-1 text-gray-600 font-medium">{pct}%</td>
											<td className="py-1 text-right">—</td>
											<td className="py-1 text-right">—</td>
										</tr>
									);
								}
								const r = calcShopee(custoUnitario * (1 + pct / 100));
								if (!r) return null;
								const lucroLiq =
									r.preco * (1 - r.faixa.pct) - r.faixa.fixo - custoUnitario;
								return (
									<tr
										key={pct}
										className="border-b border-[#E6F1FB] last:border-0"
									>
										<td className="py-1 text-gray-600 font-medium">
											<span>{pct}%</span>
											<span className="ml-1 text-gray-400 font-normal">
												({r.faixa.label})
											</span>
										</td>
										<td className="py-1 text-right font-semibold text-gray-900">
											{fmtCurrency(r.preco)}
										</td>
										<td className="py-1 text-right text-green-700">
											+{fmtCurrency(lucroLiq)}
										</td>
									</tr>
								);
							})}
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
