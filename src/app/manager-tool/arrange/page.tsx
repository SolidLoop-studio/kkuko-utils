import ArrangeHome from "./ArrangeHome"

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 단어장 관리",
		description: '끄코 유틸리티 - 단어장 관리',
		openGraph: {
			title: "끄코 유틸리티 - 단어장 관리",
			description: "끄코 유틸리티 - 단어장 관리",
			type: "website",
			url: "https://kkuko-utils.vercel.app/manager-tool/arrange",
			siteName: "끄코 유틸리티",
			locale: "ko_KR",
		},
	};
}


const arrangePage: React.FC = () => {
    return (
        <>
            <ArrangeHome />
        </>
    )
}

export default arrangePage;