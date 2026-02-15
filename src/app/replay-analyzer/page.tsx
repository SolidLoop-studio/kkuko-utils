import ReplayAnalyzerPage from './ReplayAnalyzerPage';

export async function generateMetadata() {
    return {
        title: `끄코 유틸리티 - 리플레이 분석`,
        description: `끄코 유틸리티 - 리플레이 분석`,
        openGraph: {
            title: "끄코 유틸리티 - 리플레이 분석",
            description: "끄코 유틸리티 - 리플레이 분석",
            type: "website",
            url: "https://kkuko-utils.vercel.app/replay-analyzer",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    }
}

export default function Page() {
  return <ReplayAnalyzerPage />;
}
