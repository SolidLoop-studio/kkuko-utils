import ProgramsPage from './ProgramsPage';

export async function generateMetadata() {
    return {
        title: `끄코 유틸리티 - 프로그램 모음`,
        description: `끄코에서 사용할 수 있는 다양한 프로그램들을 다운로드하고 최신 릴리즈 정보를 확인하세요.`,
        keywords: ['끄투코리아', '프로그램', '다운로드', '릴리즈', '게임도구', '유틸리티'],
        openGraph: {
            title: "끄코 유틸리티 - 프로그램 모음",
            description: "끄코에서 사용할 수 있는 다양한 프로그램들을 다운로드하고 최신 릴리즈 정보를 확인하세요.",
            type: "website",
            url: "https://kkuko-utils.vercel.app/programs",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    }
}

export default function Page() {
  return <ProgramsPage />;
}
