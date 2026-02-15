import KkukoHome from "./KkukoHome";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 끄코 정보",
		description: '끄코 유틸리티 - 끄코 정보',
		openGraph: {
			title: "끄코 유틸리티 - 끄코 정보",
			description: "끄코 유틸리티 - 끄코 정보",
			type: "website",
			url: "https://kkuko-utils.vercel.app/kkuko",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}

export default function KkukoPage() {
	return <KkukoHome />;
}