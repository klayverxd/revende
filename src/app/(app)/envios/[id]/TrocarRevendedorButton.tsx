"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, Select, useToast } from "@/components/ui";
import { trocarRevendedor } from "../actions";

interface Props {
	envioId: string;
	revendedorAtualId: string;
	revendedores: { revendedor_id: string; nome: string }[];
}

export default function TrocarRevendedorButton({
	envioId,
	revendedorAtualId,
	revendedores,
}: Props) {
	const [open, setOpen] = useState(false);
	const [novoId, setNovoId] = useState(revendedorAtualId);
	const [salvando, setSalvando] = useState(false);
	const { showToast } = useToast();
	const router = useRouter();

	const options = revendedores.map(r => ({
		value: r.revendedor_id,
		label: r.nome,
	}));

	async function handleConfirmar() {
		if (novoId === revendedorAtualId) {
			showToast("Selecione um revendedor diferente", "error");
			return;
		}
		setSalvando(true);
		try {
			await trocarRevendedor(envioId, novoId);
			showToast("Revendedor atualizado com sucesso", "success");
			setOpen(false);
			router.refresh();
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao trocar revendedor",
				"error"
			);
		} finally {
			setSalvando(false);
		}
	}

	return (
		<>
			<Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
				Trocar revendedor
			</Button>

			<Modal
				open={open}
				onClose={() => setOpen(false)}
				title="Trocar revendedor"
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
							Confirmar troca
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-600 mb-3">
					Os preços dos itens serão re-calculados automaticamente com base nas
					tabelas do novo revendedor.
				</p>
				<Select
					label="Novo revendedor"
					options={options}
					value={novoId}
					onChange={e => setNovoId(e.target.value)}
				/>
			</Modal>
		</>
	);
}
