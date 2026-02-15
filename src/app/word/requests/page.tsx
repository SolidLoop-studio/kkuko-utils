import RequestPage from "./RequestsHome";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 오픈DB 요청 목록",
        description: `끄코 유틸리티 - 오픈DB 요청 목록`,
        openGraph: {
            title: "끄코 유틸리티 - 오픈DB 요청 목록",
            description: "끄코 유틸리티 - 오픈DB 요청 목록",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/requests",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const Page = () => {
    return <RequestPage />;
};

export default Page;