import WordCombinerPage from "./WordCombinerPage";
import React from "react";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 단어조합기",
		description: '끄코 유틸리티 - 단어조합기',
		openGraph: {
			title: "끄코 유틸리티 - 단어조합기",
			description: "끄코 유틸리티 - 단어조합기",
			type: "website",
			url: "https://kkuko-utils.vercel.app/word-combiner",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}

const word_combiner_Home: React.FC = () => {
	return (
		<WordCombinerPage />
	)
}

export default word_combiner_Home;