"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { registrarDevolucao } from "../../actions";

export interface DevolucaoItem {
	envio_item_id: string;
	modelo_nome: string;
	modelo_codigo: string | null;
	qtd_enviada: number;
	qtd_vendida: number;
	qtd_devolvida: number;
	qtd_com_revendedor: number;
}

interface Props {
	readonly envioId: string;
	readonly revendedorNome: string;
	readonly itens: DevolucaoItem[];
}

export default function DevolucaoForm({
	envioId,
	revendedorNome,
	itens,
}: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [qtds, setQtds] = useState<Record<string, string>>(
		Object.fromEntries(
			itens.map(i => [i.envio_item_id, String(i.qtd_com_revendedor)])
		)
	);
	const [error, setError] = useState<string | null>(null);

	const totalDevolvendo = itens.reduce((sum, item) => {
		const val = Math.min(
			Math.max(0, Math.floor(Number(qtds[item.envio_item_id] ?? "0"))),
			item.qtd_com_revendedor
		);
		return sum + val;
	}, 0);

	function handleSubmit() {
		setError(null);
		const payload = itens
			.map(item => ({
				envioItemId: item.envio_item_id,
				qtdDevolvida: Math.min(
					Math.max(0, Math.floor(Number(qtds[item.envio_item_id] ?? "0"))),
					item.qtd_com_revendedor
				),
			}))
			.filter(i => i.qtdDevolvida > 0);

		if (!payload.length) {
			setError("Informe ao menos uma quantidade a devolver.");
			return;
		}

		startTransition(async () => {
			try {
				await registrarDevolucao(envioId, payload);
				router.push("/envios");
			} catch (e) {
				setError(
					e instanceof Error ? e.message : "Erro ao registrar devolução."
				);
			}
		});
	}

	return (
		<div className="flex flex-col gap-6 max-w-lg">
			<div>
				<p className="text-sm text-gray-600">
					Revendedor:{" "}
					<span className="font-medium text-gray-900">{revendedorNome}</span>
				</p>
				<p className="text-xs text-gray-500 mt-1">
					Informe quantas unidades estão sendo fisicamente devolvidas agora.
					Apenas os itens ainda com o revendedor aparecem abaixo.
				</p>
			</div>

			<div className="flex flex-col gap-3">
				{itens.map(item => (
					<div
						key={item.envio_item_id}
						className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3"
					>
						<div>
							<p className="text-sm font-semibold text-gray-900">
								{item.modelo_codigo ? `${item.modelo_codigo} - ` : ""}
								{item.modelo_nome}
							</p>
							<p className="text-xs text-gray-500 mt-0.5">
								Com o revendedor:{" "}
								<span className="font-medium text-gray-700">
									{item.qtd_com_revendedor} un.
								</span>
							</p>
						</div>
						<div className="grid grid-cols-2 gap-3 items-end">
							<Input
								label="Devolvendo agora"
								type="number"
								min={0}
								max={item.qtd_com_revendedor}
								value={qtds[item.envio_item_id] ?? ""}
								onChange={e =>
									setQtds(prev => ({
										...prev,
										[item.envio_item_id]: e.target.value,
									}))
								}
							/>
							<div className="rounded-md border border-[#B5D4F4] bg-[#F4F8FD] px-3 py-2 flex flex-col justify-center">
								<span className="text-xs text-gray-500">
									Fica com o revendedor
								</span>
								<span className="text-base font-semibold text-[#185FA5]">
									{Math.max(
										0,
										item.qtd_com_revendedor -
											Math.min(
												Math.max(
													0,
													Math.floor(Number(qtds[item.envio_item_id] ?? "0"))
												),
												item.qtd_com_revendedor
											)
									)}{" "}
									un.
								</span>
							</div>
						</div>
					</div>
				))}
			</div>

			{error && (
				<p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
					{error}
				</p>
			)}

			<div className="flex gap-3">
				<Button
					variant="primary"
					onClick={handleSubmit}
					loading={isPending}
					disabled={totalDevolvendo === 0}
				>
					Confirmar devolução ({totalDevolvendo} un.)
				</Button>
				<Button
					variant="ghost"
					onClick={() => router.push("/envios")}
					disabled={isPending}
				>
					Cancelar
				</Button>
			</div>
		</div>
	);
}
