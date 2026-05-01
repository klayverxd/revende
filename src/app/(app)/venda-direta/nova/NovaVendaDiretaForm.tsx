"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, useToast } from "@/components/ui";
import { criarVendaDireta, resolverPrecoVendaDireta } from "../actions";

export interface ProdutoDisponivel {
	modelo_id: string;
	codigo: string | null;
	nome: string;
	estoque_disponivel: number;
}

interface ItemSelecionado {
	modelo_id: string;
	nome: string;
	codigo: string | null;
	quantidade: number;
	preco: number;
	origem: "MODELO" | "MANUAL";
	estoque_disponivel: number;
}

interface Props {
	readonly produtos: ProdutoDisponivel[];
}

type Canal =
	| "PRESENCIAL"
	| "WHATSAPP"
	| "FEIRA"
	| "EVENTO"
	| "INSTAGRAM"
	| "OUTRO";
type Pagamento = "PIX" | "DINHEIRO" | "CARTAO" | "OUTRO";

function fmtCurrency(v: number) {
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseNum(v: string) {
	const n = parseFloat(v.replace(",", "."));
	return Number.isFinite(n) ? n : 0;
}

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

export default function NovaVendaDiretaForm({ produtos }: Props) {
	const { showToast } = useToast();
	const router = useRouter();

	const [searchProduto, setSearchProduto] = useState("");
	const [itens, setItens] = useState<ItemSelecionado[]>([]);
	const [desconto, setDesconto] = useState("0");
	const [dataVenda, setDataVenda] = useState(todayISO());
	const [canal, setCanal] = useState<Canal>("PRESENCIAL");
	const [pagamento, setPagamento] = useState<Pagamento>("PIX");
	const [clienteNome, setClienteNome] = useState("");
	const [clienteContato, setClienteContato] = useState("");
	const [observacao, setObservacao] = useState("");
	const [saving, setSaving] = useState(false);
	const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
	const [vendaConcluida, setVendaConcluida] = useState(false);

	const produtosFiltrados = useMemo(() => {
		const term = searchProduto.toLowerCase();
		return produtos
			.filter(
				p =>
					p.nome.toLowerCase().includes(term) ||
					(p.codigo ?? "").toLowerCase().includes(term)
			)
			.slice(0, 30);
	}, [produtos, searchProduto]);

	const subtotal = useMemo(
		() => itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
		[itens]
	);
	const descontoNum = Math.max(0, parseNum(desconto || "0"));
	const total = Math.max(0, subtotal - descontoNum);

	async function adicionarProduto(produto: ProdutoDisponivel) {
		if (itens.some(i => i.modelo_id === produto.modelo_id)) {
			showToast("Produto ja adicionado", "info");
			return;
		}

		setLoadingPriceId(produto.modelo_id);
		try {
			const preco = await resolverPrecoVendaDireta(produto.modelo_id);
			setItens(prev => [
				...prev,
				{
					modelo_id: produto.modelo_id,
					nome: produto.nome,
					codigo: produto.codigo,
					quantidade: 1,
					preco: preco.preco ?? 0,
					origem: "MODELO",
					estoque_disponivel: produto.estoque_disponivel,
				},
			]);
		} catch {
			showToast("Erro ao resolver preco", "error");
		} finally {
			setLoadingPriceId(null);
		}
	}

	async function atualizarQuantidade(modeloId: string, quantidade: number) {
		if (!Number.isFinite(quantidade) || quantidade <= 0) return;

		setItens(prev =>
			prev.map(i => (i.modelo_id === modeloId ? { ...i, quantidade } : i))
		);

		const item = itens.find(i => i.modelo_id === modeloId);
		if (!item || item.origem === "MANUAL") return;

		try {
			const resolvido = await resolverPrecoVendaDireta(modeloId);
			if (resolvido.preco !== null) {
				setItens(prev =>
					prev.map(i =>
						i.modelo_id === modeloId
							? { ...i, preco: resolvido.preco ?? i.preco, origem: "MODELO" }
							: i
					)
				);
			}
		} catch {
			// mantém preço atual
		}
	}

	function atualizarPrecoManual(modeloId: string, preco: number) {
		setItens(prev =>
			prev.map(i =>
				i.modelo_id === modeloId
					? {
							...i,
							preco: Number.isFinite(preco) ? preco : 0,
							origem: "MANUAL",
						}
					: i
			)
		);
	}

	function removerItem(modeloId: string) {
		setItens(prev => prev.filter(i => i.modelo_id !== modeloId));
	}

	async function confirmarVenda() {
		if (itens.length === 0) {
			showToast("Adicione ao menos um item", "error");
			return;
		}

		setSaving(true);
		try {
			await criarVendaDireta({
				itens: itens.map(i => ({
					modeloId: i.modelo_id,
					quantidade: i.quantidade,
					preco: i.preco,
					origem: i.origem,
				})),
				desconto: descontoNum,
				canal,
				forma_pagamento: pagamento,
				cliente_nome: clienteNome,
				cliente_contato: clienteContato,
				observacao: observacao,
				data_venda: dataVenda,
			});
			showToast("Venda registrada com sucesso", "success");
			setVendaConcluida(true);
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao registrar venda",
				"error"
			);
		} finally {
			setSaving(false);
		}
	}

	function registrarOutra() {
		setItens([]);
		setDesconto("0");
		setCanal("PRESENCIAL");
		setPagamento("PIX");
		setClienteNome("");
		setClienteContato("");
		setObservacao("");
		setDataVenda(todayISO());
		setVendaConcluida(false);
	}

	if (vendaConcluida) {
		return (
			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				<p className="text-sm text-gray-800">
					Venda confirmada com sucesso no valor de{" "}
					<strong>{fmtCurrency(total)}</strong>.
				</p>
				<div className="flex items-center gap-2">
					<Button onClick={registrarOutra}>Registrar outra venda</Button>
					<Button
						variant="secondary"
						onClick={() => router.push("/venda-direta")}
					>
						Voltar
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 md:p-5 flex flex-col gap-4">
			<div className="flex flex-col gap-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
					Itens
				</p>
				<Input
					placeholder="Buscar produto..."
					value={searchProduto}
					onChange={e => setSearchProduto(e.target.value)}
				/>

				<div className="max-h-52 overflow-y-auto rounded-lg border border-[#B5D4F4]">
					{produtosFiltrados.map(p => (
						<button
							key={p.modelo_id}
							type="button"
							onClick={() => adicionarProduto(p)}
							disabled={loadingPriceId === p.modelo_id}
							className="w-full border-b border-[#B5D4F4] last:border-b-0 px-3 py-2 text-left hover:bg-[#F4F8FD] disabled:opacity-50"
						>
							<p className="text-sm font-medium text-gray-900">
								{p.codigo ? `${p.codigo} - ` : ""}
								{p.nome}
							</p>
							<p className="text-xs text-gray-700">
								Estoque disponivel: {p.estoque_disponivel}
							</p>
						</button>
					))}
				</div>

				<div className="flex flex-col gap-2">
					{itens.map(item => (
						<div
							key={item.modelo_id}
							className="rounded-lg border border-[#B5D4F4] p-3"
						>
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{item.codigo ? `${item.codigo} - ` : ""}
										{item.nome}
									</p>
									<p className="text-xs text-gray-700">
										Estoque: {item.estoque_disponivel}
									</p>
								</div>
								<span className="text-xs text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
									{item.origem === "MODELO" ? "Padrao" : "Manual"}
								</span>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 items-end">
								<div>
									<label className="text-[11px] text-gray-700">Qtd</label>
									<input
										type="number"
										min={1}
										value={item.quantidade}
										onChange={e =>
											atualizarQuantidade(
												item.modelo_id,
												parseInt(e.target.value || "1", 10)
											)
										}
										className="w-full h-9 rounded-md border border-[#B5D4F4] px-2 text-sm"
									/>
								</div>
								<div>
									<label className="text-[11px] text-gray-700">Preco</label>
									<input
										type="number"
										step="0.01"
										min={0}
										value={item.preco}
										onChange={e =>
											atualizarPrecoManual(
												item.modelo_id,
												parseFloat(e.target.value || "0")
											)
										}
										className="w-full h-9 rounded-md border border-[#B5D4F4] px-2 text-sm"
									/>
								</div>
								<div className="sm:col-span-2 text-sm text-gray-700">
									Subtotal:{" "}
									<span className="font-semibold">
										{fmtCurrency(item.preco * item.quantidade)}
									</span>
								</div>
							</div>

							<div className="mt-2 flex justify-end">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => removerItem(item.modelo_id)}
								>
									Remover
								</Button>
							</div>
						</div>
					))}
				</div>

				<Input
					label="Desconto (R$)"
					type="number"
					step="0.01"
					value={desconto}
					onChange={e => setDesconto(e.target.value)}
				/>
			</div>

			<div className="flex flex-col gap-3">
				<p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
					Detalhes
				</p>

				<div className="flex flex-col gap-1">
					<span className="text-[13px] text-gray-600 font-medium">Canal</span>
					<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1 flex-wrap">
						{(
							[
								"PRESENCIAL",
								"WHATSAPP",
								"FEIRA",
								"EVENTO",
								"INSTAGRAM",
								"OUTRO",
							] as const
						).map(c => (
							<button
								key={c}
								type="button"
								onClick={() => setCanal(c)}
								className={[
									"rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
									canal === c
										? "bg-[#185FA5] text-white"
										: "text-gray-700 hover:bg-[#E6F1FB]",
								].join(" ")}
							>
								{c}
							</button>
						))}
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-[13px] text-gray-600 font-medium">
						Pagamento
					</span>
					<div className="inline-flex rounded-lg border border-[#B5D4F4] bg-white p-1 flex-wrap">
						{(["PIX", "DINHEIRO", "CARTAO", "OUTRO"] as const).map(p => (
							<button
								key={p}
								type="button"
								onClick={() => setPagamento(p)}
								className={[
									"rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
									pagamento === p
										? "bg-[#185FA5] text-white"
										: "text-gray-700 hover:bg-[#E6F1FB]",
								].join(" ")}
							>
								{p}
							</button>
						))}
					</div>
				</div>

				<Input
					label="Data da venda"
					type="date"
					value={dataVenda}
					onChange={e => setDataVenda(e.target.value)}
				/>
				<Input
					label="Cliente (opcional)"
					value={clienteNome}
					onChange={e => setClienteNome(e.target.value)}
				/>
				<Input
					label="Contato (opcional)"
					value={clienteContato}
					onChange={e => setClienteContato(e.target.value)}
				/>

				<div className="flex flex-col gap-1">
					<label className="text-[13px] text-gray-600 font-medium">
						Observacao
					</label>
					<textarea
						rows={3}
						className="w-full rounded-md border border-[#B5D4F4] px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:border-[#185FA5] focus:ring-[#185FA5]"
						value={observacao}
						onChange={e => setObservacao(e.target.value)}
					/>
				</div>
			</div>

			<div className="rounded-xl border border-[#B5D4F4] bg-[#E6F1FB] p-3 flex flex-col gap-1 text-sm">
				<p className="text-[#0C447C]">
					Subtotal: <strong>{fmtCurrency(subtotal)}</strong>
				</p>
				<p className="text-[#0C447C]">
					Desconto: <strong>{fmtCurrency(descontoNum)}</strong>
				</p>
				<p className="text-[#185FA5] text-base">
					Total: <strong>{fmtCurrency(total)}</strong>
				</p>
			</div>

			<Button className="w-full" onClick={confirmarVenda} loading={saving}>
				Confirmar venda
			</Button>
		</div>
	);
}
