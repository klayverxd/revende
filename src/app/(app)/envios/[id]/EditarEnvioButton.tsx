"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Modal, Select, useToast } from "@/components/ui";
import { editarEnvio, trocarRevendedor } from "../actions";

interface Props {
	envioId: string;
	dataAtual: string;
	observacaoAtual: string;
	revendedorAtualId: string;
	revendedores: { revendedor_id: string; nome: string }[];
}

export default function EditarEnvioButton({
	envioId,
	dataAtual,
	observacaoAtual,
	revendedorAtualId,
	revendedores,
}: Props) {
	const [open, setOpen] = useState(false);
	const [dataEnvio, setDataEnvio] = useState(dataAtual);
	const [observacao, setObservacao] = useState(observacaoAtual);
	const [revendedorId, setRevendedorId] = useState(revendedorAtualId);
	const [salvando, setSalvando] = useState(false);
	const { showToast } = useToast();
	const router = useRouter();

	const options = revendedores.map(r => ({
		value: r.revendedor_id,
		label: r.nome,
	}));

	function handleOpen() {
		setDataEnvio(dataAtual);
		setObservacao(observacaoAtual);
		setRevendedorId(revendedorAtualId);
		setOpen(true);
	}

	async function handleConfirmar() {
		setSalvando(true);
		try {
			const promises: Promise<void>[] = [
				editarEnvio(envioId, { dataEnvio, observacao }),
			];
			if (revendedorId !== revendedorAtualId) {
				promises.push(trocarRevendedor(envioId, revendedorId));
			}
			await Promise.all(promises);
			showToast("Envio atualizado com sucesso", "success");
			setOpen(false);
			router.refresh();
		} catch (err) {
			showToast(err instanceof Error ? err.message : "Erro ao salvar", "error");
		} finally {
			setSalvando(false);
		}
	}

	return (
		<>
			<Button variant="secondary" size="sm" onClick={handleOpen}>
				Editar envio
			</Button>

			<Modal
				open={open}
				onClose={() => setOpen(false)}
				title="Editar envio"
				footer={
					<>
						<Button
							variant="ghost"
							onClick={() => setOpen(false)}
							disabled={salvando}
						>
							Cancelar
						</Button>
						<Button onClick={handleConfirmar} loading={salvando}>
							Salvar
						</Button>
					</>
				}
			>
				<div className="flex flex-col gap-4">
					<Select
						label="Revendedor"
						options={options}
						value={revendedorId}
						onChange={e => setRevendedorId(e.target.value)}
					/>
					{revendedorId !== revendedorAtualId && (
						<p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
							Os preços dos itens serão re-calculados com base nas tabelas do
							novo revendedor.
						</p>
					)}
					<Input
						label="Data do envio"
						type="date"
						value={dataEnvio}
						onChange={e => setDataEnvio(e.target.value)}
					/>
					<div className="flex flex-col gap-1">
						<label className="text-[13px] text-gray-600 font-medium">
							Observação
						</label>
						<textarea
							rows={3}
							className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
							placeholder="Opcional"
							value={observacao}
							onChange={e => setObservacao(e.target.value)}
						/>
					</div>
				</div>
			</Modal>
		</>
	);
}
