import ProgramDetailPage from './ProgramDetailPage';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;  
  return {
        title: `끄코 유틸리티 - 프로그램 상세 정보`,
        description: `프로그램의 상세 정보와 릴리즈 히스토리를 확인하고 다운로드하세요.`,
        keywords: ['끄투코리아', '프로그램', '다운로드', '릴리즈', '게임도구', '유틸리티'],
        openGraph: {
            title: "끄코 유틸리티 - 프로그램 상세 정보",
            description: "프로그램의 상세 정보와 릴리즈 히스토리를 확인하고 다운로드하세요.",
            type: "website",
            url: `https://kkuko-utils.vercel.app/programs/${id}`,
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    }
}

export default function Page() {
  return <ProgramDetailPage />;
}
