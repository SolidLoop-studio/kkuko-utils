import NotFound from "@/src/app/not-found-client";
import DocsLogPage from "./DocsLogPage";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return {
        title: "끄코 유틸리티 - 단어장공유",
        description: `끄코 유틸리티 - 단어장 공유 ${id}번 문서 로그`,
        openGraph: {
            title: "끄코 유틸리티 - 단어장공유",
            description: `끄코 유틸리티 - 단어장 공유 ${id}번 문서 로그`,
            type: "website",
            url: `https://kkuko-utils.vercel.app/words-docs/${id}/logs`,
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const LogsPage = async ({ params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const docsID = Number(id);

    if (isNaN(docsID)) return <NotFound />;
    return <DocsLogPage id={docsID}/>
};

export default LogsPage;
