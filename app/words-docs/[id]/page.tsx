import NotFound from "@/app/not-found-client";
import DocsDataPage from "./DocsDataPage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const {id} = await params;
    return {
        title: "끄코 유틸리티 - 단어장공유",
        description: `끄코 유틸리티 - 단어장 공유 ${id}번 문서`,
        openGraph: {
            title: "끄코 유틸리티 - 단어장공유",
            description: `끄코 유틸리티 - 단어장 공유 ${id}번 문서`,
            type: "website",
            url: `https://kkuko-utils.vercel.app/words-docs/${id}`,
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const DocsDataHomePage = async ({ params }: { params: Promise<{ id: string }> }) => {
    const {id} = await params;
    const nid = Number(id)

    return isNaN(nid) ? <NotFound /> : <DocsDataPage id={nid} />
    
}

export default DocsDataHomePage;