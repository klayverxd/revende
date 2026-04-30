"use client";

interface BulkActionBarProps {
	readonly selectedCount: number;
	readonly onDelete?: () => void;
	readonly onActivate?: () => void;
	readonly onDeactivate?: () => void;
	readonly onClear: () => void;
}

export default function BulkActionBar({
	selectedCount,
	onDelete,
	onActivate,
	onDeactivate,
	onClear,
}: Readonly<BulkActionBarProps>) {
	if (selectedCount === 0) return null;

	return (
		<div className="flex items-center gap-3 px-4 py-2.5 bg-[#E6F1FB] border border-[#B5D4F4] rounded-lg animate-[slideDown_0.15s_ease-out]">
			<span className="text-sm text-[#185FA5] font-medium mr-1">
				{selectedCount}{" "}
				{selectedCount === 1 ? "item selecionado" : "itens selecionados"}
			</span>

			<div className="flex items-center gap-2 ml-auto">
				{onActivate && (
					<button
						onClick={onActivate}
						className="h-8 px-3 text-xs rounded-md bg-white border border-[#B5D4F4] text-[#185FA5] hover:bg-[#E6F1FB] transition-colors font-medium"
					>
						Ativar
					</button>
				)}
				{onDeactivate && (
					<button
						onClick={onDeactivate}
						className="h-8 px-3 text-xs rounded-md bg-white border border-[#B5D4F4] text-[#185FA5] hover:bg-[#E6F1FB] transition-colors font-medium"
					>
						Desativar
					</button>
				)}
				{onDelete && (
					<button
						onClick={onDelete}
						className="h-8 px-3 text-xs rounded-md bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors font-medium"
					>
						Deletar
					</button>
				)}
				<button
					onClick={onClear}
					className="h-8 px-3 text-xs rounded-md text-gray-600 hover:bg-white hover:text-gray-800 transition-colors font-medium"
				>
					Cancelar
				</button>
			</div>
		</div>
	);
}
