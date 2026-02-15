import KoreanMissionB from "./KoreanMissionB";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 단어장 관리",
        description: '끄코 유틸리티 - 단어장 관리',
        openGraph: {
            title: "끄코 유틸리티 - 단어장 관리",
            description: "끄코 유틸리티 - 단어장 관리",
            type: "website",
            url: "https://kkuko-utils.vercel.app/manager-tool/extract/korean-mission-b",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const KoreanMissionBPage: React.FC = () => {
    return (
        <>
            <KoreanMissionB />
        </>
    )
}

export default KoreanMissionBPage;