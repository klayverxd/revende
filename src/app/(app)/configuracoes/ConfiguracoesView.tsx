"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Modal, useToast } from "@/components/ui";
import {
	desfazerConferencia,
	desfazerRecebimento,
	limparDados,
	type GrupoLimpeza,
} from "./actions";

export interface ConferenciaRecente {
	envio_id: string;
	status: "CONFERIDO" | "ENCERRADO";
	data_envio: string;
	updated_at: string;
	revendedor_nome: string;
}

export interface AcertoRecebidoRecente {
	acerto_id: string;
	data_recebimento: string | null;
	valor_repassado: number | null;
	updated_at: string;
	revendedor_nome: string;
}

interface Props {
	readonly conferencias: ConferenciaRecente[];
	readonly acertos: AcertoRecebidoRecente[];
}

type Tab = "DESFAZER" | "LIMPAR";

function fmtDate(d: string | null) {
	if (!d) return "—";
	return new Date(d).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number | null) {
	if (v === null || v === undefined) return "—";
	return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Dados dos grupos de limpeza ────────────────────────────────────────────
const GRUPOS: Array<{
	id: GrupoLimpeza;
	label: string;
	descricao: string;
	cor: string;
}> = [
	{
		id: "envios",
		label: "Envios e Conferências",
		descricao: "Remove todos os envios, itens e acertos financeiros.",
		cor: "border-amber-200 bg-amber-50",
	},
	{
		id: "modelos",
		label: "Modelos e Preços",
		descricao:
			"Remove todos os modelos, faixas de preço e preços por revendedor.",
		cor: "border-blue-200 bg-blue-50",
	},
	{
		id: "revendedores",
		label: "Revendedores",
		descricao: "Remove todos os revendedores e seus preços personalizados.",
		cor: "border-blue-200 bg-blue-50",
	},
	{
		id: "vendas",
		label: "Vendas Diretas",
		descricao: "Remove todas as vendas diretas e seus itens.",
		cor: "border-purple-200 bg-purple-50",
	},
	{
		id: "producoes",
		label: "Produções",
		descricao: "Remove todos os registros de entrada de estoque.",
		cor: "border-green-200 bg-green-50",
	},
	{
		id: "calculadora",
		label: "Calculadora",
		descricao:
			"Remove todos os cálculos salvos, equipamentos e matérias-primas configurados.",
		cor: "border-gray-200 bg-gray-50",
	},
];

// ─── Componente principal ───────────────────────────────────────────────────
export default function ConfiguracoesView({ conferencias, acertos }: Props) {
	const { showToast } = useToast();
	const [tab, setTab] = useState<Tab>("DESFAZER");

	// Undo states
	const [desfazendoConferencia, setDesfazendoConferencia] = useState<
		string | null
	>(null);
	const [confirmConferencia, setConfirmConferencia] =
		useState<ConferenciaRecente | null>(null);

	const [desfazendoAcerto, setDesfazendoAcerto] = useState<string | null>(null);
	const [confirmAcerto, setConfirmAcerto] =
		useState<AcertoRecebidoRecente | null>(null);

	// Limpar states
	const [confirmLimpar, setConfirmLimpar] = useState<GrupoLimpeza | null>(null);
	const [confirmLimparTudo, setConfirmLimparTudo] = useState(false);
	const [isPending, startTransition] = useTransition();

	// ── Handlers ────────────────────────────────────────────────────────────

	async function handleDesfazerConferencia(envioId: string) {
		setDesfazendoConferencia(envioId);
		try {
			await desfazerConferencia(envioId);
			showToast("Conferência desfeita — envio voltou para ABERTO", "success");
			setConfirmConferencia(null);
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao desfazer conferência",
				"error"
			);
		} finally {
			setDesfazendoConferencia(null);
		}
	}

	async function handleDesfazerAcerto(acertoId: string) {
		setDesfazendoAcerto(acertoId);
		try {
			await desfazerRecebimento(acertoId);
			showToast(
				"Recebimento desfeito — acerto voltou para PENDENTE",
				"success"
			);
			setConfirmAcerto(null);
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao desfazer recebimento",
				"error"
			);
		} finally {
			setDesfazendoAcerto(null);
		}
	}

	function handleLimpar(grupo: GrupoLimpeza) {
		startTransition(async () => {
			try {
				await limparDados(grupo);
				const label =
					grupo === "tudo"
						? "Todos os dados foram removidos"
						: `Dados de "${GRUPOS.find(g => g.id === grupo)?.label ?? grupo}" removidos`;
				showToast(label, "success");
			} catch (err) {
				showToast(
					err instanceof Error ? err.message : "Erro ao limpar dados",
					"error"
				);
			} finally {
				setConfirmLimpar(null);
				setConfirmLimparTudo(false);
			}
		});
	}

	// ── Renderização ─────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col gap-6">
			{/* Tabs */}
			<div className="flex gap-1 border-b border-[#B5D4F4]">
				{(
					[
						{ id: "DESFAZER" as Tab, label: "Desfazer Ações" },
						{ id: "LIMPAR" as Tab, label: "Limpar Dados" },
					] as const
				).map(({ id, label }) => (
					<button
						key={id}
						onClick={() => setTab(id)}
						className={[
							"px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
							tab === id
								? "border-[#185FA5] text-[#185FA5]"
								: "border-transparent text-gray-500 hover:text-gray-800",
						].join(" ")}
					>
						{label}
					</button>
				))}
			</div>

			{/* ── Aba: Desfazer Ações ─────────────────────────────────────────── */}
			{tab === "DESFAZER" && (
				<div className="flex flex-col gap-6">
					{/* Conferências recentes */}
					<section>
						<h2 className="text-sm font-semibold text-gray-700 mb-3">
							Últimas conferências
						</h2>
						{conferencias.length === 0 ? (
							<p className="text-sm text-gray-500">
								Nenhuma conferência recente encontrada.
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{conferencias.map(c => (
									<div
										key={c.envio_id}
										className="rounded-xl border border-[#B5D4F4] bg-white px-4 py-3 flex items-center justify-between gap-3"
									>
										<div className="flex flex-col gap-0.5">
											<p className="text-sm font-medium text-gray-900">
												{c.revendedor_nome}
											</p>
											<p className="text-xs text-gray-500">
												Envio de {fmtDate(c.data_envio)} · Conferido em{" "}
												{fmtDate(c.updated_at)}
											</p>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<Badge
												variant={c.status === "ENCERRADO" ? "neutral" : "info"}
											>
												{c.status}
											</Badge>
											<Button
												variant="danger"
												size="sm"
												loading={desfazendoConferencia === c.envio_id}
												onClick={() => setConfirmConferencia(c)}
											>
												Desfazer
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					{/* Acertos recebidos recentes */}
					<section>
						<h2 className="text-sm font-semibold text-gray-700 mb-3">
							Últimos recebimentos registrados
						</h2>
						{acertos.length === 0 ? (
							<p className="text-sm text-gray-500">
								Nenhum recebimento recente encontrado.
							</p>
						) : (
							<div className="flex flex-col gap-2">
								{acertos.map(a => (
									<div
										key={a.acerto_id}
										className="rounded-xl border border-[#B5D4F4] bg-white px-4 py-3 flex items-center justify-between gap-3"
									>
										<div className="flex flex-col gap-0.5">
											<p className="text-sm font-medium text-gray-900">
												{a.revendedor_nome}
											</p>
											<p className="text-xs text-gray-500">
												Recebido em {fmtDate(a.data_recebimento)} ·{" "}
												{fmtCurrency(a.valor_repassado)}
											</p>
										</div>
										<div className="flex items-center gap-2 shrink-0">
											<Badge variant="success">RECEBIDO</Badge>
											<Button
												variant="danger"
												size="sm"
												loading={desfazendoAcerto === a.acerto_id}
												onClick={() => setConfirmAcerto(a)}
											>
												Desfazer
											</Button>
										</div>
									</div>
								))}
							</div>
						)}
					</section>
				</div>
			)}

			{/* ── Aba: Limpar Dados ────────────────────────────────────────────── */}
			{tab === "LIMPAR" && (
				<div className="flex flex-col gap-6">
					<p className="text-sm text-gray-600">
						Remove registros por categoria. Os dados são arquivados (soft
						delete) — não aparecem mais na interface, mas o histórico fica
						preservado no banco.
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						{GRUPOS.map(g => (
							<div
								key={g.id}
								className={`rounded-xl border p-4 flex flex-col gap-3 ${g.cor}`}
							>
								<div>
									<p className="text-sm font-semibold text-gray-900">
										{g.label}
									</p>
									<p className="text-xs text-gray-600 mt-0.5">{g.descricao}</p>
								</div>
								<Button
									variant="danger"
									size="sm"
									className="self-end"
									onClick={() => setConfirmLimpar(g.id)}
								>
									Limpar
								</Button>
							</div>
						))}
					</div>

					{/* Limpar tudo */}
					<div className="rounded-xl border border-red-300 bg-red-50 p-4 flex flex-col gap-3">
						<div>
							<p className="text-sm font-semibold text-red-900">Limpar tudo</p>
							<p className="text-xs text-red-700 mt-0.5">
								Remove todos os dados do sistema — modelos, revendedores,
								envios, conferências, acertos, vendas, produções e calculadora.
								Esta ação não pode ser desfeita.
							</p>
						</div>
						<Button
							variant="danger"
							size="sm"
							className="self-end border-red-400 bg-red-100 text-red-800 hover:bg-red-200"
							onClick={() => setConfirmLimparTudo(true)}
						>
							Limpar tudo
						</Button>
					</div>
				</div>
			)}

			{/* ── Modal: Confirmar desfazer conferência ───────────────────────── */}
			<Modal
				open={!!confirmConferencia}
				onClose={() => setConfirmConferencia(null)}
				title="Desfazer conferência"
				footer={
					<>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setConfirmConferencia(null)}
						>
							Cancelar
						</Button>
						<Button
							variant="danger"
							size="sm"
							loading={desfazendoConferencia === confirmConferencia?.envio_id}
							onClick={() =>
								confirmConferencia &&
								handleDesfazerConferencia(confirmConferencia.envio_id)
							}
						>
							Confirmar desfazer
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-700">
					O envio de <strong>{confirmConferencia?.revendedor_nome}</strong> de{" "}
					{fmtDate(confirmConferencia?.data_envio ?? null)} voltará para o
					status <strong>ABERTO</strong> e todas as quantidades contadas serão
					zeradas. O acerto financeiro associado também será removido.
				</p>
				<p className="text-xs text-amber-700 mt-2">
					Esta ação não pode ser desfeita automaticamente.
				</p>
			</Modal>

			{/* ── Modal: Confirmar desfazer recebimento ───────────────────────── */}
			<Modal
				open={!!confirmAcerto}
				onClose={() => setConfirmAcerto(null)}
				title="Desfazer recebimento"
				footer={
					<>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setConfirmAcerto(null)}
						>
							Cancelar
						</Button>
						<Button
							variant="danger"
							size="sm"
							loading={desfazendoAcerto === confirmAcerto?.acerto_id}
							onClick={() =>
								confirmAcerto && handleDesfazerAcerto(confirmAcerto.acerto_id)
							}
						>
							Confirmar desfazer
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-700">
					O recebimento de{" "}
					<strong>{fmtCurrency(confirmAcerto?.valor_repassado ?? null)}</strong>{" "}
					de <strong>{confirmAcerto?.revendedor_nome}</strong> voltará para o
					status <strong>PENDENTE</strong>.
				</p>
				<p className="text-xs text-amber-700 mt-2">
					O envio associado voltará para CONFERIDO caso esteja ENCERRADO.
				</p>
			</Modal>

			{/* ── Modal: Confirmar limpar grupo ───────────────────────────────── */}
			<Modal
				open={!!confirmLimpar}
				onClose={() => setConfirmLimpar(null)}
				title="Confirmar limpeza"
				footer={
					<>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setConfirmLimpar(null)}
						>
							Cancelar
						</Button>
						<Button
							variant="danger"
							size="sm"
							loading={isPending}
							onClick={() => confirmLimpar && handleLimpar(confirmLimpar)}
						>
							Limpar dados
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-700">
					Você está prestes a remover todos os dados de{" "}
					<strong>{GRUPOS.find(g => g.id === confirmLimpar)?.label}</strong>. Os
					registros serão arquivados e não aparecerão mais na interface.
				</p>
				<p className="text-xs text-red-700 mt-2">
					Atenção: dados dependentes (acertos, itens, etc.) também serão
					removidos.
				</p>
			</Modal>

			{/* ── Modal: Confirmar limpar tudo ────────────────────────────────── */}
			<Modal
				open={confirmLimparTudo}
				onClose={() => setConfirmLimparTudo(false)}
				title="Limpar todos os dados"
				footer={
					<>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setConfirmLimparTudo(false)}
						>
							Cancelar
						</Button>
						<Button
							variant="danger"
							size="sm"
							loading={isPending}
							onClick={() => handleLimpar("tudo")}
						>
							Limpar tudo
						</Button>
					</>
				}
			>
				<p className="text-sm text-gray-700">
					Esta ação removerá <strong>todos os dados</strong> do sistema:
					modelos, revendedores, envios, conferências, acertos, vendas diretas,
					produções e configurações da calculadora.
				</p>
				<p className="text-xs text-red-700 mt-3 font-medium">
					Atenção: esta ação não pode ser desfeita. Tem certeza?
				</p>
			</Modal>
		</div>
	);
}
