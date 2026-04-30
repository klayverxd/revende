"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import ProdutoModal from "../ProdutoModal";

interface Modelo {
	modelo_id: string;
	codigo: string;
	nome: string;
	descricao?: string | null;
	custo_producao?: number | null;
	estoque_minimo?: number | null;
	ativo: boolean;
}

interface Props {
	readonly modelo: Modelo;
}

function fmt(v: number | null | undefined) {
	if (v == null) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProdutoDadosGerais({ modelo }: Props) {
	const [editOpen, setEditOpen] = useState(false);

	return (
		<div className="bg-white rounded-xl border border-[#B5D4F4] p-6 flex flex-col gap-5 max-w-xl">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold text-gray-900">Dados gerais</h2>
				<Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
					Editar
				</Button>
			</div>

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
				}}
			/>
		</div>
	);
}
