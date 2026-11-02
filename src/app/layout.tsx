import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
	title: "Imprimimos",
	description: "Gestão de impressão 3D — produção, catálogo, consignado e financeiro",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Imprimimos",
	},
};

export const viewport: Viewport = {
	themeColor: "#0C447C",
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html
			lang="pt-BR"
			className={`${geist.variable} h-full antialiased`}
			suppressHydrationWarning
		>
			<body className="min-h-full font-sans" suppressHydrationWarning>
				{children}
			</body>
		</html>
	);
}
