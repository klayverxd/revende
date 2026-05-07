"use client";

import { useState, useRef } from "react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import {
	salvarPrecoKwh,
	salvarPctFalhas,
	salvarEquipamento,
	toggleEquipamento,
	salvarMateriaPrima,
	toggleMateriaPrima,
	salvarCustoExtra,
	toggleCustoExtra,
} from "../actions";

export interface EquipamentoRow {
	equipamento_id: string;
	nome: string;
	potencia_watts: number;
	depreciacao_hora: number;
	valor_maquina: number | null;
	tempo_meses: number | null;
	horas_por_dia: number | null;
	dias_por_mes: number | null;
	ativa: boolean;
}

export type UnidadeMedida = "kg" | "litro" | "metro" | "unidade";

export interface MateriaPrimaRow {
	materia_prima_id: string;
	nome: string;
	preco_por_unidade: number;
	unidade_medida: UnidadeMedida;
	ativo: boolean;
}

export interface CustoExtraRow {
	custo_extra_id: string;
	nome: string;
	valor: number;
	ativo: boolean;
}

interface Props {
	readonly precoKwh: number;
	readonly pctFalhasPadrao: number;
	readonly equipamentos: EquipamentoRow[];
	readonly materias: MateriaPrimaRow[];
	readonly custosExtras: CustoExtraRow[];
}

export default function ConfigCalculadoraView({
	precoKwh,
	pctFalhasPadrao,
	equipamentos,
	materias,
	custosExtras,
}: Props) {
	const { showToast } = useToast();
	const [preco, setPreco] = useState(precoKwh ? String(precoKwh) : "");
	const [pctFalhas, setPctFalhas] = useState(
		pctFalhasPadrao ? String(pctFalhasPadrao * 100) : "5"
	);
	const precoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pctTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	function handlePrecoChange(value: string) {
		setPreco(value);
		if (precoTimer.current) clearTimeout(precoTimer.current);
		const val = Number.parseFloat(value.replace(",", "."));
		if (!Number.isFinite(val) || val <= 0) return;
		precoTimer.current = setTimeout(async () => {
			try {
				await salvarPrecoKwh(val);
				showToast("Preço de energia salvo", "success");
			} catch {
				showToast("Erro ao salvar preço de energia", "error");
			}
		}, 800);
	}

	function handlePctChange(value: string) {
		setPctFalhas(value);
		if (pctTimer.current) clearTimeout(pctTimer.current);
		const val = Number.parseFloat(value.replace(",", "."));
		if (!Number.isFinite(val) || val < 0 || val > 100) return;
		pctTimer.current = setTimeout(async () => {
			try {
				await salvarPctFalhas(val);
				showToast("% de falhas salva", "success");
			} catch {
				showToast("Erro ao salvar % de falhas", "error");
			}
		}, 800);
	}
	const [equipOpen, setEquipOpen] = useState(false);
	const [equipEdit, setEquipEdit] = useState<EquipamentoRow | null>(null);
	const [matOpen, setMatOpen] = useState(false);
	const [matEdit, setMatEdit] = useState<MateriaPrimaRow | null>(null);

	const [equipNome, setEquipNome] = useState("");
	const [equipPotKw, setEquipPotKw] = useState("");
	const [equipValor, setEquipValor] = useState("");
	const [equipMeses, setEquipMeses] = useState("");
	const [equipHorasDia, setEquipHorasDia] = useState("");
	const [equipDiasMes, setEquipDiasMes] = useState("");

	const [matNome, setMatNome] = useState("");
	const [matPreco, setMatPreco] = useState("");
	const [matUnid, setMatUnid] = useState<UnidadeMedida>("kg");

	const [extraOpen, setExtraOpen] = useState(false);
	const [extraEdit, setExtraEdit] = useState<CustoExtraRow | null>(null);
	const [extraNome, setExtraNome] = useState("");
	const [extraValor, setExtraValor] = useState("");

	function abrirEquip(e?: EquipamentoRow) {
		setEquipEdit(e ?? null);
		setEquipNome(e?.nome ?? "");
		setEquipPotKw(e ? String(e.potencia_watts / 1000) : "");
		setEquipValor(e?.valor_maquina == null ? "" : String(e.valor_maquina));
		setEquipMeses(e?.tempo_meses == null ? "" : String(e.tempo_meses));
		setEquipHorasDia(e?.horas_por_dia == null ? "" : String(e.horas_por_dia));
		setEquipDiasMes(e?.dias_por_mes == null ? "" : String(e.dias_por_mes));
		setEquipOpen(true);
	}

	function abrirMat(m?: MateriaPrimaRow) {
		setMatEdit(m ?? null);
		setMatNome(m?.nome ?? "");
		setMatPreco(m ? String(m.preco_por_unidade) : "");
		setMatUnid(m?.unidade_medida ?? "kg");
		setMatOpen(true);
	}

	function abrirExtra(x?: CustoExtraRow) {
		setExtraEdit(x ?? null);
		setExtraNome(x?.nome ?? "");
		setExtraValor(x ? String(x.valor) : "");
		setExtraOpen(true);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<h2 className="text-sm font-semibold text-gray-900">Energia</h2>
				<div className="flex flex-wrap gap-4 max-w-sm">
					<div className="flex-1 min-w-32">
						<Input
							label="Preço por kWh (R$)"
							type="number"
							step="0.0001"
							value={preco}
							onChange={e => handlePrecoChange(e.target.value)}
						/>
					</div>
					<div className="flex-1 min-w-32">
						<Input
							label="% de falhas padrão"
							type="number"
							step="0.1"
							tooltip="Percentual de peças descartadas por falha de impressão"
							value={pctFalhas}
							onChange={e => handlePctChange(e.target.value)}
						/>
					</div>
				</div>
			</div>

			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-gray-900">Equipamentos</h2>
					<Button size="sm" onClick={() => abrirEquip()}>
						+ Adicionar equipamento
					</Button>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
								<th className="px-3 py-2 text-left">Nome</th>
								<th className="px-3 py-2 text-right">Potência (KW)</th>
								<th className="px-3 py-2 text-right">Depreciação (R$/h)</th>
								<th className="px-3 py-2 text-center">Ativo</th>
								<th className="px-3 py-2 text-right">Ações</th>
							</tr>
						</thead>
						<tbody>
							{equipamentos.map(e => (
								<tr
									key={e.equipamento_id}
									className="border-b border-[#B5D4F4] last:border-0"
								>
									<td className="px-3 py-2 text-gray-900">{e.nome}</td>
									<td className="px-3 py-2 text-right text-gray-700">
										{(e.potencia_watts / 1000).toLocaleString("pt-BR", {
											minimumFractionDigits: 2,
										})}
									</td>
									<td className="px-3 py-2 text-right text-gray-700">
										{e.depreciacao_hora.toLocaleString("pt-BR", {
											minimumFractionDigits: 4,
										})}
									</td>
									<td className="px-3 py-2 text-center text-gray-700">
										{e.ativa ? "Sim" : "Não"}
									</td>
									<td className="px-3 py-2 text-right">
										<div className="inline-flex gap-1">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => abrirEquip(e)}
											>
												Editar
											</Button>
											<Button
												size="sm"
												variant="secondary"
												onClick={async () => {
													try {
														await toggleEquipamento(e.equipamento_id, !e.ativa);
														showToast("Status atualizado", "success");
													} catch (err) {
														showToast(
															err instanceof Error
																? err.message
																: "Erro ao atualizar",
															"error"
														);
													}
												}}
											>
												{e.ativa ? "Desativar" : "Ativar"}
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-gray-900">
						Matérias-primas
					</h2>
					<Button size="sm" onClick={() => abrirMat()}>
						+ Adicionar matéria-prima
					</Button>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
								<th className="px-3 py-2 text-left">Nome</th>
								<th className="px-3 py-2 text-right">Preço/unidade (R$)</th>
								<th className="px-3 py-2 text-left">Unidade</th>
								<th className="px-3 py-2 text-center">Ativo</th>
								<th className="px-3 py-2 text-right">Ações</th>
							</tr>
						</thead>
						<tbody>
							{materias.map(m => (
								<tr
									key={m.materia_prima_id}
									className="border-b border-[#B5D4F4] last:border-0"
								>
									<td className="px-3 py-2 text-gray-900">{m.nome}</td>
									<td className="px-3 py-2 text-right text-gray-700">
										{m.preco_por_unidade}
									</td>
									<td className="px-3 py-2 text-gray-700">
										{m.unidade_medida}
									</td>
									<td className="px-3 py-2 text-center text-gray-700">
										{m.ativo ? "Sim" : "Não"}
									</td>
									<td className="px-3 py-2 text-right">
										<div className="inline-flex gap-1">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => abrirMat(m)}
											>
												Editar
											</Button>
											<Button
												size="sm"
												variant="secondary"
												onClick={async () => {
													try {
														await toggleMateriaPrima(
															m.materia_prima_id,
															!m.ativo
														);
														showToast("Status atualizado", "success");
													} catch (err) {
														showToast(
															err instanceof Error
																? err.message
																: "Erro ao atualizar",
															"error"
														);
													}
												}}
											>
												{m.ativo ? "Desativar" : "Ativar"}
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<h2 className="text-sm font-semibold text-gray-900">Custos extras</h2>
					<Button size="sm" onClick={() => abrirExtra()}>
						+ Adicionar custo extra
					</Button>
				</div>
				<p className="text-xs text-gray-500">
					Custos por peça além da impressão, como argolas, embalagens ou
					acessórios.
				</p>
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-[#B5D4F4] bg-[#F4F8FD]">
								<th className="px-3 py-2 text-left">Nome</th>
								<th className="px-3 py-2 text-right">Valor/peça (R$)</th>
								<th className="px-3 py-2 text-center">Ativo</th>
								<th className="px-3 py-2 text-right">Ações</th>
							</tr>
						</thead>
						<tbody>
							{custosExtras.map(x => (
								<tr
									key={x.custo_extra_id}
									className="border-b border-[#B5D4F4] last:border-0"
								>
									<td className="px-3 py-2 text-gray-900">{x.nome}</td>
									<td className="px-3 py-2 text-right text-gray-700">
										{x.valor.toLocaleString("pt-BR", {
											minimumFractionDigits: 2,
										})}
									</td>
									<td className="px-3 py-2 text-center text-gray-700">
										{x.ativo ? "Sim" : "Não"}
									</td>
									<td className="px-3 py-2 text-right">
										<div className="inline-flex gap-1">
											<Button
												size="sm"
												variant="ghost"
												onClick={() => abrirExtra(x)}
											>
												Editar
											</Button>
											<Button
												size="sm"
												variant="secondary"
												onClick={async () => {
													try {
														await toggleCustoExtra(x.custo_extra_id, !x.ativo);
														showToast("Status atualizado", "success");
													} catch (err) {
														showToast(
															err instanceof Error
																? err.message
																: "Erro ao atualizar",
															"error"
														);
													}
												}}
											>
												{x.ativo ? "Desativar" : "Ativar"}
											</Button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			<Modal
				open={equipOpen}
				onClose={() => setEquipOpen(false)}
				title={equipEdit ? "Editar equipamento" : "Novo equipamento"}
				footer={
					<>
						<Button variant="ghost" onClick={() => setEquipOpen(false)}>
							Cancelar
						</Button>
						<Button
							onClick={async () => {
								try {
									await salvarEquipamento({
										equipamento_id: equipEdit?.equipamento_id,
										nome: equipNome,
										potencia_kw: Number.parseFloat(
											equipPotKw.replace(",", ".")
										),
										valor_maquina: Number.parseFloat(
											equipValor.replace(",", ".")
										),
										tempo_meses: Number.parseInt(equipMeses, 10),
										horas_por_dia: Number.parseFloat(
											equipHorasDia.replace(",", ".")
										),
										dias_por_mes: Number.parseInt(equipDiasMes, 10),
									});
									showToast("Equipamento salvo", "success");
									setEquipOpen(false);
								} catch (err) {
									showToast(
										err instanceof Error ? err.message : "Erro ao salvar",
										"error"
									);
								}
							}}
						>
							Salvar
						</Button>
					</>
				}
			>
				{(() => {
					const meses = Number.parseInt(equipMeses, 10) || 0;
					const hDia = Number.parseFloat(equipHorasDia.replace(",", ".")) || 0;
					const dMes = Number.parseInt(equipDiasMes, 10) || 0;
					const valor = Number.parseFloat(equipValor.replace(",", ".")) || 0;
					const horasTotais = hDia * dMes * meses;
					const depHora = horasTotais > 0 ? valor / horasTotais : 0;
					return (
						<div className="flex flex-col gap-3">
							<Input
								label="Nome"
								value={equipNome}
								onChange={e => setEquipNome(e.target.value)}
							/>
							<Input
								label="Potência (KW)"
								type="number"
								step="0.001"
								placeholder="0.15"
								value={equipPotKw}
								onChange={e => setEquipPotKw(e.target.value)}
							/>
							<Input
								label="Valor da máquina (R$)"
								type="number"
								step="0.01"
								placeholder="4000.00"
								value={equipValor}
								onChange={e => setEquipValor(e.target.value)}
							/>
							<div className="grid grid-cols-3 gap-2">
								<Input
									label="Meses"
									type="number"
									min={1}
									placeholder="24"
									value={equipMeses}
									onChange={e => setEquipMeses(e.target.value)}
								/>
								<Input
									label="Horas/dia"
									type="number"
									step="0.5"
									placeholder="15"
									value={equipHorasDia}
									onChange={e => setEquipHorasDia(e.target.value)}
								/>
								<Input
									label="Dias/mês"
									type="number"
									min={1}
									max={31}
									placeholder="25"
									value={equipDiasMes}
									onChange={e => setEquipDiasMes(e.target.value)}
								/>
							</div>
							{horasTotais > 0 && (
								<div className="rounded-lg bg-[#F4F8FD] border border-[#B5D4F4] px-3 py-2 text-sm flex flex-col gap-1">
									<div className="flex justify-between text-gray-600">
										<span>Horas totais no período</span>
										<strong>{horasTotais.toLocaleString("pt-BR")} h</strong>
									</div>
									<div className="flex justify-between text-gray-800">
										<span className="font-medium">Depreciação/hora</span>
										<strong className="text-[#185FA5]">
											{depHora.toLocaleString("pt-BR", {
												style: "currency",
												currency: "BRL",
												minimumFractionDigits: 4,
											})}
										</strong>
									</div>
								</div>
							)}
						</div>
					);
				})()}
			</Modal>

			<Modal
				open={matOpen}
				onClose={() => setMatOpen(false)}
				title={matEdit ? "Editar matéria-prima" : "Nova matéria-prima"}
				footer={
					<>
						<Button variant="ghost" onClick={() => setMatOpen(false)}>
							Cancelar
						</Button>
						<Button
							onClick={async () => {
								try {
									await salvarMateriaPrima({
										materia_prima_id: matEdit?.materia_prima_id,
										nome: matNome,
										preco_por_unidade: Number.parseFloat(
											matPreco.replace(",", ".")
										),
										unidade_medida: matUnid,
									});
									showToast("Matéria-prima salva", "success");
									setMatOpen(false);
								} catch (err) {
									showToast(
										err instanceof Error ? err.message : "Erro ao salvar",
										"error"
									);
								}
							}}
						>
							Salvar
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-3">
					<Input
						label="Nome"
						value={matNome}
						onChange={e => setMatNome(e.target.value)}
					/>
					<Input
						label="Preço por unidade (R$)"
						type="number"
						step="0.0001"
						value={matPreco}
						onChange={e => setMatPreco(e.target.value)}
					/>
					<Select
						label="Unidade"
						options={[
							{ value: "kg", label: "kg" },
							{ value: "litro", label: "litro" },
							{ value: "metro", label: "metro" },
							{ value: "unidade", label: "unidade" },
						]}
						value={matUnid}
						onChange={e =>
							setMatUnid(e.target.value as "kg" | "litro" | "metro" | "unidade")
						}
					/>
				</div>
			</Modal>

			<Modal
				open={extraOpen}
				onClose={() => setExtraOpen(false)}
				title={extraEdit ? "Editar custo extra" : "Novo custo extra"}
				footer={
					<>
						<Button variant="ghost" onClick={() => setExtraOpen(false)}>
							Cancelar
						</Button>
						<Button
							onClick={async () => {
								try {
									await salvarCustoExtra({
										custo_extra_id: extraEdit?.custo_extra_id,
										nome: extraNome,
										valor: Number.parseFloat(extraValor.replace(",", ".")),
									});
									showToast("Custo extra salvo", "success");
									setExtraOpen(false);
								} catch (err) {
									showToast(
										err instanceof Error ? err.message : "Erro ao salvar",
										"error"
									);
								}
							}}
						>
							Salvar
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-3">
					<Input
						label="Nome"
						placeholder="Ex: Argola para chaveiro"
						value={extraNome}
						onChange={e => setExtraNome(e.target.value)}
					/>
					<Input
						label="Valor por peça (R$)"
						type="number"
						step="0.0001"
						placeholder="0.35"
						value={extraValor}
						onChange={e => setExtraValor(e.target.value)}
					/>
				</div>
			</Modal>
		</div>
	);
}
