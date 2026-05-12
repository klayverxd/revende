"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { salvarFotoUrl } from "@/app/(app)/produtos/actions";
import { useToast } from "@/components/ui";

const BUCKET = "produto-fotos";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

interface Props {
	readonly modeloId: string;
	readonly fotoUrl: string | null;
}

export default function FotoUpload({ modeloId, fotoUrl }: Props) {
	const { showToast } = useToast();
	const inputRef = useRef<HTMLInputElement>(null);
	const [preview, setPreview] = useState<string | null>(fotoUrl);
	const [uploading, setUploading] = useState(false);
	const [, startTransition] = useTransition();

	async function handleFile(file: File) {
		if (!file.type.startsWith("image/")) {
			showToast("Apenas imagens são permitidas (JPEG, PNG, WebP)", "error");
			return;
		}
		if (file.size > MAX_SIZE) {
			showToast("A imagem deve ter no máximo 5 MB", "error");
			return;
		}

		setUploading(true);
		try {
			const supabase = createClient();
			const ext = file.name.split(".").pop() ?? "jpg";
			const path = `${modeloId}/foto.${ext}`;

			const { error: uploadError } = await supabase.storage
				.from(BUCKET)
				.upload(path, file, { upsert: true, contentType: file.type });

			if (uploadError) throw new Error(uploadError.message);

			const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
			// Append cache-buster so the browser refreshes the image
			const url = `${data.publicUrl}?t=${Date.now()}`;

			setPreview(url);
			startTransition(async () => {
				await salvarFotoUrl(modeloId, data.publicUrl);
			});
			showToast("Foto salva com sucesso", "success");
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao fazer upload",
				"error"
			);
		} finally {
			setUploading(false);
		}
	}

	async function handleRemove() {
		setUploading(true);
		try {
			const supabase = createClient();
			// Remove all objects under this model's folder
			const { data: list } = await supabase.storage.from(BUCKET).list(modeloId);
			if (list && list.length > 0) {
				const paths = list.map(f => `${modeloId}/${f.name}`);
				await supabase.storage.from(BUCKET).remove(paths);
			}
			setPreview(null);
			startTransition(async () => {
				await salvarFotoUrl(modeloId, null);
			});
			showToast("Foto removida", "success");
		} catch (err) {
			showToast(
				err instanceof Error ? err.message : "Erro ao remover foto",
				"error"
			);
		} finally {
			setUploading(false);
		}
	}

	function handleDrop(e: React.DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file) handleFile(file);
	}

	return (
		<div className="flex flex-col gap-3">
			{preview ? (
				<div className="relative w-40 h-40 rounded-xl overflow-hidden border border-[#B5D4F4] bg-[#F4F8FD]">
					<Image
						src={preview}
						alt="Foto do produto"
						fill
						className="object-cover"
						sizes="160px"
					/>
					{!uploading && (
						<button
							type="button"
							onClick={handleRemove}
							className="absolute top-1.5 right-1.5 bg-white/90 hover:bg-white text-red-600 rounded-full p-1 shadow transition-colors"
							title="Remover foto"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								className="w-4 h-4"
							>
								<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
							</svg>
						</button>
					)}
					{uploading && (
						<div className="absolute inset-0 bg-white/60 flex items-center justify-center">
							<span className="text-xs text-gray-600">Salvando…</span>
						</div>
					)}
				</div>
			) : (
				<button
					type="button"
					disabled={uploading}
					onClick={() => inputRef.current?.click()}
					onDrop={handleDrop}
					onDragOver={e => e.preventDefault()}
					className="w-40 h-40 rounded-xl border-2 border-dashed border-[#B5D4F4] bg-[#F4F8FD] flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{uploading ? (
						<span className="text-xs">Enviando…</span>
					) : (
						<>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={1.5}
								className="w-8 h-8"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5M12 3v9m0 0-3-3m3 3 3-3"
								/>
							</svg>
							<span className="text-xs text-center px-2">
								Clique ou arraste uma foto
							</span>
						</>
					)}
				</button>
			)}

			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp"
				className="hidden"
				onChange={e => {
					const file = e.target.files?.[0];
					if (file) handleFile(file);
					e.target.value = "";
				}}
			/>

			{!preview && (
				<p className="text-[11px] text-gray-400">
					JPEG, PNG ou WebP · máx. 5 MB
				</p>
			)}
		</div>
	);
}
