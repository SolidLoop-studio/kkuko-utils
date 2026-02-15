
import WordInfoPage from './WordInfoPage';

export async function generateMetadata({ params }: { params: Promise<{ query: string }> }) {
    const query = decodeURIComponent((await params).query);
    return {
        title: `${query} - 끄코 유틸리티`,
        description: `끄코 유틸리티 - 단어 검색: ${query}`,
        openGraph: {
            title: `${query} - 끄코 유틸리티`,
            description: `끄코 유틸리티 - 단어 검색: ${query}`,
            type: "website",
            url: `https://kkuko-utils.vercel.app/word/search/${encodeURIComponent(query)}`,
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default async function SearchPage({ params }: { params: Promise<{ query: string }> }) {
    const query = decodeURIComponent((await params).query);
    return (
        <div className="">
            <WordInfoPage query={query} />
        </div>
    );
}