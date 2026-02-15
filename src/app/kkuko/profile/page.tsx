import { Suspense } from 'react'
import KkukoProfile from './KkukoProfile'

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 끄코 유저 정보",
		description: '끄코 유틸리티 - 끄코 유저 정보',
		openGraph: {
			title: "끄코 유틸리티 - 끄코 유저 정보",
			description: "끄코 유틸리티 - 끄코 유저 정보",
			type: "website",
			url: "https://kkuko-utils.vercel.app/kkuko/profile",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}

export default function KkukoProfilePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <KkukoProfile />
        </Suspense>
    );
}