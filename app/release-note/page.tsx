import ReleaseNote from "./ReleaseNote";
import React from "react";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 릴리즈 노트",
		description: '끄코 유틸리티 - 릴리즈 노트',
		openGraph: {
			title: "끄코 유틸리티 - 릴리즈 노트",
			description: "끄코 유틸리티 - 릴리즈 노트",
			type: "website",
			url: "https://kkuko-utils.vercel.app/release-note",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}

const ReleaseNotePage: React.FC = () => {
    return (
        <ReleaseNote />
    )
}

export default ReleaseNotePage;