import NotFound from "@/src/app/not-found-client";
import DocsInfoPage from "./DocsInfoPage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return {
        title: "끄코 유틸리티 - 단어장공유",
        description: `끄코 유틸리티 - 단어장 공유 ${id}번 문서 정보`,
        openGraph: {
            title: "끄코 유틸리티 - 단어장공유",
            description: `끄코 유틸리티 - 단어장 공유 ${id}번 문서 정보`,
            type: "website",
            url: `https://kkuko-utils.vercel.app/words-docs/${id}/info`,
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const InfoPage = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const DocsID = Number(id)

    if (isNaN(DocsID)) return <NotFound />
    return <DocsInfoPage id={DocsID} />
    
};

export default InfoPage;