export function fmtData(s: string | null | undefined): string {
	if (!s) return "—";
	const d = s.slice(0, 10); // garante YYYY-MM-DD
	return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}
