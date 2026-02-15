import React from "react";
import AuthPage from "./auth";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 로그인/회원가입",
		description: '끄코 유틸리티 - 로그인/회원가입',
		openGraph: {
			title: "끄코 유틸리티 - 로그인/회원가입",
			description: "끄코 유틸리티 - 로그인/회원가입",
			type: "website",
			url: "https://kkuko-utils.vercel.app/auth",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}

const OAuthPage: React.FC = () => {
    return (
        <AuthPage />
    )
}

export default OAuthPage;