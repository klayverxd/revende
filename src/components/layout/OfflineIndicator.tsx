"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
	const [isOnline, setIsOnline] = useState(true);

	useEffect(() => {
		setIsOnline(navigator.onLine);

		const handleOnline = () => setIsOnline(true);
		const handleOffline = () => setIsOnline(false);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	if (isOnline) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-400 text-amber-900 text-center py-2 text-sm font-medium">
			Sem conexão — algumas funções indisponíveis
		</div>
	);
}
