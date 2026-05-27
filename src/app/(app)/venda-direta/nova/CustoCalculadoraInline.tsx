"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";

export interface EquipamentoConfig {
	equipamento_id: string;
	nome: string;
	potencia_watts: number;
	depreciacao_hora: number;
}

export interface MateriaPrimaConfig {
	materia_prima_id: string;
	nome: string;
	preco_por_unidade: number;
	unidade_medida: string;
}

export interface ConfigCalculadora {
	equipamentos: EquipamentoConfig[];
	materias: MateriaPrimaConfig[];
	preco_kwh: number;
	pct_falhas_padrao: number;
}

interface Props {
	config: ConfigCalculadora;
	quantidade: number;
	onUsarPreco: (preco: number) => void;
}

interface MateriaSelecionada {
	uid: string;
	materia_prima_id: string;
	quantidade: string;
}

function uid() {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const MARGENS = [50, 100, 150, 200, 300];

export default function CustoCalculadoraInline({ config, quantidade, onUsarPreco }: Props) {
	const [equipId, setEquipId] = useState(config.equipamentos[0]?.equipamento_id ?? "");
	const [horas, setHoras] = useState("0");
	const [minutos, setMinutos] = useState("30");
	const [pctFalhas, setPctFalhas] = useState(String(config.pct_falhas_padrao));
	const [materias, setMaterias] = useState<MateriaSelecionada[]>([]);
	const [margem, setMargem] = useState(100);

	const equip = config.equipamentos.find(e => e.equipamento_id === equipId) ?? null;

	function addMateria() {
		const primeira = config.materias[0];
		if (!primeira) return;
		setMaterias(prev => [
			...prev,
			{ uid: uid(), materia_prima_id: primeira.materia_prima_id, quantidade: "1" },
		]);
	}

	function removeMateria(u: string) {
		setMaterias(prev => prev.filter(m => m.uid !== u));
	}

	function updateMateria(u: string, field: "materia_prima_id" | "quantidade", value: string) {
		setMaterias(prev => prev.map(m => m.uid === u ? { ...m, [field]: value } : m));
	}

	const custo = useMemo(() => {
		if (!equip) return null;

		const tempoHoras = Math.max(0, Number.parseFloat(horas) || 0) +
			Math.max(0, Number.parseFloat(minutos) || 0) / 60;

		const custoEnergia = (equip.potencia_watts / 1000) * config.preco_kwh * tempoHoras;
		const custoDepreciacao = equip.depreciacao_hora * tempoHoras;

		const custoMateriais = materias.reduce((s, m) => {
			const mp = config.materias.find(x => x.materia_prima_id === m.materia_prima_id);
			return s + (mp ? (Number.parseFloat(m.quantidade) || 0) * mp.preco_por_unidade : 0);
		}, 0);

		const pct = Math.max(0, Number.parseFloat(pctFalhas) || 0) / 100;
		const custoFalhas = custoMateriais * pct;
		const custoTotal = custoEnergia + custoDepreciacao + custoMateriais + custoFalhas;
		const qtd = Math.max(1, quantidade);
		const custoUnitario = custoTotal / qtd;

		return { custoEnergia, custoDepreciacao, custoMateriais, custoFalhas, custoTotal, custoUnitario };
	}, [equip, horas, minutos, config, materias, pctFalhas, quantidade]);

	const precoSugerido = custo ? Number((custo.custoUnitario * (1 + margem / 100)).toFixed(2)) : 0;

	if (config.equipamentos.length === 0) {
		return (
			<p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
				Nenhum equipamento cadastrado. Configure em <strong>Calculadora</strong> antes de usar.
			</p>
		);
	}

	return (
		<div className="rounded-lg border border-[#B5D4F4] bg-white p-3 flex flex-col gap-3">
			{/* Equipamento */}
			<div className="flex flex-col gap-1">
				<label className="text-[12px] text-gray-600 font-medium">Equipamento</label>
				<select
					value={equipId}
					onChange={e => setEquipId(e.target.value)}
					className="rounded-md border border-[#B5D4F4] bg-white px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
				>
					{config.equipamentos.map(e => (
						<option key={e.equipamento_id} value={e.equipamento_id}>{e.nome}</option>
					))}
				</select>
			</div>

			{/* Tempo */}
			<div className="grid grid-cols-2 gap-2">
				<Input label="Horas" type="number" min={0} value={horas}
					onChange={e => setHoras(e.target.value)} />
				<Input label="Minutos" type="number" min={0} max={59} value={minutos}
					onChange={e => setMinutos(e.target.value)} />
			</div>

			{/* Matérias-primas */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-[12px] text-gray-600 font-medium">Matérias-primas</span>
					<button
						type="button"
						onClick={addMateria}
						className="text-xs text-[#378ADD] hover:underline"
					>
						+ Adicionar
					</button>
				</div>
				{materias.length === 0 && (
					<p className="text-xs text-gray-400">Nenhuma matéria-prima adicionada.</p>
				)}
				{materias.map(m => {
					const mp = config.materias.find(x => x.materia_prima_id === m.materia_prima_id);
					return (
						<div key={m.uid} className="flex items-center gap-2">
							<select
								value={m.materia_prima_id}
								onChange={e => updateMateria(m.uid, "materia_prima_id", e.target.value)}
								className="flex-1 rounded-md border border-[#B5D4F4] bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
							>
								{config.materias.map(x => (
									<option key={x.materia_prima_id} value={x.materia_prima_id}>{x.nome}</option>
								))}
							</select>
							<input
								type="number"
								min={0}
								step="0.01"
								value={m.quantidade}
								onChange={e => updateMateria(m.uid, "quantidade", e.target.value)}
								className="w-20 rounded-md border border-[#B5D4F4] px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
							/>
							<span className="text-xs text-gray-500 w-8 shrink-0">{mp?.unidade_medida ?? ""}</span>
							<button
								type="button"
								onClick={() => removeMateria(m.uid)}
								className="text-xs text-red-400 hover:text-red-600 shrink-0"
							>
								✕
							</button>
						</div>
					);
				})}
			</div>

			{/* % Falhas */}
			<Input label="% Falhas / desperdício" type="number" min={0} max={100} step="0.1"
				value={pctFalhas} onChange={e => setPctFalhas(e.target.value)} />

			{/* Resultado */}
			{custo && (
				<div className="rounded-lg border border-[#E6F1FB] bg-[#F4F8FD] text-xs divide-y divide-[#E6F1FB]">
					{[
						["Energia", custo.custoEnergia],
						["Materiais", custo.custoMateriais],
						["Depreciação", custo.custoDepreciacao],
						[`Falhas (${pctFalhas}%)`, custo.custoFalhas],
					].map(([label, valor]) => (
						<div key={label as string} className="flex justify-between px-3 py-1.5 text-gray-600">
							<span>{label as string}</span>
							<span>{fmtCurrency(valor as number)}</span>
						</div>
					))}
					<div className="flex justify-between px-3 py-2 font-semibold text-gray-800">
						<span>Custo total ({quantidade} un.)</span>
						<span>{fmtCurrency(custo.custoTotal)}</span>
					</div>
					<div className="flex justify-between px-3 py-2 font-semibold text-[#0C447C]">
						<span>Custo por unidade</span>
						<span>{fmtCurrency(custo.custoUnitario)}</span>
					</div>
				</div>
			)}

			{/* Margem e preço sugerido */}
			{custo && custo.custoUnitario > 0 && (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<span className="text-[12px] text-gray-600 font-medium shrink-0">Margem de lucro:</span>
						<div className="flex flex-wrap gap-1">
							{MARGENS.map(m => (
								<button
									key={m}
									type="button"
									onClick={() => setMargem(m)}
									className={[
										"px-2 py-0.5 rounded text-xs font-medium transition-colors",
										margem === m
											? "bg-[#185FA5] text-white"
											: "bg-[#E6F1FB] text-[#185FA5] hover:bg-[#B5D4F4]",
									].join(" ")}
								>
									{m}%
								</button>
							))}
						</div>
					</div>
					<div className="flex items-center justify-between rounded-lg bg-[#E6F1FB] px-3 py-2">
						<span className="text-sm text-[#0C447C]">
							Preço sugerido: <strong>{fmtCurrency(precoSugerido)}</strong>
						</span>
						<Button size="sm" onClick={() => onUsarPreco(precoSugerido)}>
							Usar este preço
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
