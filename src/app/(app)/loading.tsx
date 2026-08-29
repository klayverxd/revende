/**
 * Fallback de carregamento das rotas autenticadas.
 *
 * Todas as páginas são Server Components que fazem várias queries em
 * paralelo; sem este arquivo a navegação ficava travada na tela anterior, sem
 * nenhum sinal de que algo estava acontecendo.
 *
 * Esqueleto em vez de spinner: mantém a altura da página estável e evita o
 * salto de layout quando o conteúdo chega.
 */
export default function CarregandoApp() {
	return (
		<div className="flex flex-col gap-6 animate-pulse" aria-busy="true">
			<span className="sr-only">Carregando…</span>

			{/* Cabeçalho */}
			<div className="flex flex-col gap-2">
				<div className="h-6 w-48 rounded bg-[#E6F1FB]" />
				<div className="h-4 w-72 rounded bg-[#E6F1FB]" />
			</div>

			{/* Cartões de resumo */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[0, 1, 2, 3].map(i => (
					<div
						key={i}
						className="h-20 rounded-xl border border-[#B5D4F4] bg-white"
					/>
				))}
			</div>

			{/* Corpo */}
			<div className="rounded-xl border border-[#B5D4F4] bg-white p-4 flex flex-col gap-3">
				{[0, 1, 2, 3, 4].map(i => (
					<div key={i} className="h-4 rounded bg-[#E6F1FB]" />
				))}
			</div>
		</div>
	);
}
