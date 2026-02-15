import LogPage from './LogsHome'

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 오픈DB 로그",
        description: `끄코 유틸리티 - 오픈DB 로그`,
        openGraph: {
            title: "끄코 유틸리티 - 오픈DB 로그",
            description: "끄코 유틸리티 - 오픈DB 로그",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/logs",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function LogsPage() {
    return (
        <LogPage />
    )
}