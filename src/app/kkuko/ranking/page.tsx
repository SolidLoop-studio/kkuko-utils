import { Suspense } from "react";
import KkukoRaking from "./KkukoRaking";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 끄코 랭킹",
		description: '끄코 유틸리티 - 끄코 랭킹',
		openGraph: {
			title: "끄코 유틸리티 - 끄코 랭킹",
			description: "끄코 유틸리티 - 끄코 랭킹",
			type: "website",
			url: "https://kkuko-utils.vercel.app/kkuko/ranking",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}

export default function KkukoRakingPage() {
    return (
		<Suspense fallback={<div>Loading...</div>}>
			<KkukoRaking />
		</Suspense>
	);
}