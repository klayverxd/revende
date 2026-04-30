"use client";

import { useState } from "react";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import {
	salvarPrecoKwh,
	salvarEquipamento,
	toggleEquipamento,
	salvarMateriaPrima,
	toggleMateriaPrima,
} from "../actions";

export interface EquipamentoRow {
	equipamento_id: string;
	nome: string;
	potencia_watts: number;
	depreciacao_hora: number;
	ativa: boolean;
}

export interface MateriaPrimaRow {
	materia_prima_id: string;
	nome: string;
	preco_por_unidade: number;
	unidade_medida: "kg" | "litro" | "metro" | "unidade";
	ativo: boolean;
}

interface Props {
	readonly precoKwh: number;
	readonly equipamentos: EquipamentoRow[];
	readonly materias: MateriaPrimaRow[];
}

export default function ConfigCalculadoraView({
	precoKwh,
	equipamentos,
	materias,
}: Props) {
	const { showToast } = useToast();
	const [preco, setPreco] = useState(String(precoKwh || ""));
	const [equipOpen, setEquipOpen] = useState(false);
	const [equipEdit, setEquipEdit] = useState<EquipamentoRow | null>(null);
	const [matOpen, setMatOpen] = useState(false);
	const [matEdit, setMatEdit] = useState<MateriaPrimaRow | null>(null);

	const [equipNome, setEquipNome] = useState("");
	const [equipPot, setEquipPot] = useState("");
	const [equipDep, setEquipDep] = useState("");

	const [matNome, setMatNome] = useState("");
	const [matPreco, setMatPreco] = useState("");
	const [matUnid, setMatUnid] = useState<"kg" | "litro" | "metro" | "unidade">(
		"kg"
	);

	function abrirEquip(e?: EquipamentoRow) {
		setEquipEdit(e ?? null);
		setEquipNome(e?.nome ?? "");
		setEquipPot(e ? String(e.potencia_watts) : "");
		setEquipDep(e ? String(e.depreciacao_hora) : "");
		setEquipOpen(true);
	}

	function abrirMat(m?: MateriaPrimaRow) {
		setMatEdit(m ?? null);
		setMatNome(m?.nome ?? "");
		setMatPreco(m ? String(m.preco_por_unidade) : "");
		setMatUnid(m?.unidade_medida ?? "kg");
		setMatOpen(true);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<h2 className="text-sm font-semibold text-gray-900">Energia</h2>
				<div className="flex items-end gap-2 max-w-sm">
					<Input
						label="Preço por kWh (R$)"
						type="number"
						step="0.0001"
						value={preco}
						onChange={e => setPreco(e.target.value)}
					/>
					<Button
						onClick={async () => {
							try {
								await salvarPrecoKwh(parseFloat(preco.replace(",", ".")));
								showToast("Preço de energia salvo", "success");
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
								<th className="px-3 py-2 text-right">Potência (W)</th>
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
										{e.potencia_watts}
									</td>
									<td className="px-3 py-2 text-right text-gray-700">
										{e.depreciacao_hora}
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
										potencia_watts: parseFloat(equipPot.replace(",", ".")),
										depreciacao_hora: parseFloat(equipDep.replace(",", ".")),
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
				<div className="flex flex-col gap-3">
					<Input
						label="Nome"
						value={equipNome}
						onChange={e => setEquipNome(e.target.value)}
					/>
					<Input
						label="Potência (W)"
						type="number"
						value={equipPot}
						onChange={e => setEquipPot(e.target.value)}
					/>
					<Input
						label="Depreciação (R$/h)"
						type="number"
						step="0.0001"
						value={equipDep}
						onChange={e => setEquipDep(e.target.value)}
					/>
				</div>
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
										preco_por_unidade: parseFloat(matPreco.replace(",", ".")),
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
		</div>
	);
}
