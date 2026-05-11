"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
	value: string;
	label: string;
}

interface SearchableSelectProps {
	label?: string;
	required?: boolean;
	error?: string;
	placeholder?: string;
	searchPlaceholder?: string;
	options: SearchableSelectOption[];
	value: string;
	onChange: (value: string) => void;
}

function normalize(s: string) {
	return s
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036f]/g, "")
		.toLowerCase();
}

function getBorderClass(open: boolean) {
	if (open) return "border-[#185FA5] ring-1 ring-[#185FA5]";
	return "border-[#B5D4F4] focus:border-[#185FA5] focus:ring-[#185FA5]";
}

function getOptionClass(isSelected: boolean, isHighlighted: boolean) {
	const base = "w-full text-left px-3 py-2 text-sm cursor-pointer select-none";
	if (isSelected) return `${base} bg-[#E6F1FB] text-[#185FA5] font-medium`;
	if (isHighlighted) return `${base} bg-gray-50`;
	return `${base} text-gray-800 hover:bg-gray-50`;
}

export default function SearchableSelect({
	label,
	required,
	error,
	placeholder = "Selecione...",
	searchPlaceholder = "Buscar...",
	options,
	value,
	onChange,
}: Readonly<SearchableSelectProps>) {
	const [open, setOpen] = useState(false);
	const [busca, setBusca] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const [highlighted, setHighlighted] = useState(0);

	const selected = options.find(o => o.value === value);

	const filtered = useMemo(() => {
		const q = normalize(busca.trim());
		if (!q) return options;
		return options.filter(o => normalize(o.label).includes(q));
	}, [options, busca]);

	// Focus search input when dropdown opens
	useEffect(() => {
		if (open) {
			setTimeout(() => searchRef.current?.focus(), 0);
		}
	}, [open]);

	// Close on outside click
	useEffect(() => {
		function handler(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, []);

	function select(optValue: string) {
		onChange(optValue);
		setOpen(false);
		setBusca("");
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (!open) {
			if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
				e.preventDefault();
				setOpen(true);
			}
			return;
		}
		if (e.key === "Escape") {
			setOpen(false);
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			setHighlighted(h => Math.min(h + 1, filtered.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setHighlighted(h => Math.max(h - 1, 0));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const opt = filtered[highlighted];
			if (opt) select(opt.value);
		}
	}

	// Scroll highlighted item into view
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const item = list.children[highlighted] as HTMLElement | undefined;
		item?.scrollIntoView({ block: "nearest" });
	}, [highlighted]);

	return (
		<div className="flex flex-col gap-1" ref={containerRef}>
			{label && (
				<label className="text-[13px] text-gray-700 font-medium">
					{label}
					{required && <span className="text-red-500 ml-1">*</span>}
				</label>
			)}

			{/* Trigger */}
			<button
				type="button"
				onKeyDown={handleKeyDown}
				onClick={() => {
					if (!open) {
						setBusca("");
						setHighlighted(0);
					}
					setOpen(o => !o);
				}}
				className={[
					"w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-white transition-colors text-left",
					"focus:outline-none focus:ring-1",
					error
						? "border-red-400 focus:border-red-500 focus:ring-red-500"
						: getBorderClass(open),
				].join(" ")}
			>
				<span className={selected ? "text-gray-900" : "text-gray-400"}>
					{selected ? selected.label : placeholder}
				</span>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className={`shrink-0 ml-2 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>

			{/* Dropdown */}
			{open && (
				<div className="relative z-50">
					<div className="absolute top-1 left-0 right-0 rounded-md border border-[#B5D4F4] bg-white shadow-lg overflow-hidden">
						{/* Search input */}
						<div className="p-2 border-b border-[#E6F1FB]">
							<div className="relative">
								<svg
									className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<circle cx="11" cy="11" r="8" />
									<path d="m21 21-4.35-4.35" />
								</svg>
								<input
									ref={searchRef}
									type="text"
									value={busca}
									onChange={e => {
										setBusca(e.target.value);
										setHighlighted(0);
									}}
									onKeyDown={handleKeyDown}
									placeholder={searchPlaceholder}
									className="w-full rounded border border-[#B5D4F4] pl-7 pr-2 py-1.5 text-sm focus:outline-none focus:border-[#185FA5] focus:ring-1 focus:ring-[#185FA5]"
								/>
							</div>
						</div>

						{/* Options list */}
						<div
							ref={listRef}
							className="flex flex-col max-h-52 overflow-y-auto py-1"
						>
							{filtered.length === 0 ? (
								<div className="px-3 py-2 text-sm text-gray-400 text-center">
									Nenhum resultado
								</div>
							) : (
								filtered.map((opt, idx) => (
									<button
										key={opt.value}
										type="button"
										onMouseDown={() => select(opt.value)}
										onMouseEnter={() => setHighlighted(idx)}
										className={getOptionClass(
											opt.value === value,
											idx === highlighted
										)}
									>
										{opt.label}
									</button>
								))
							)}
						</div>
					</div>
				</div>
			)}

			{error && <p className="text-[12px] text-red-600">{error}</p>}
		</div>
	);
}
