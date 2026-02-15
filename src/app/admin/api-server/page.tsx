import React from 'react';
import ApiServerManagerHome from "./ApiServerMangerHome";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 관리자 페이지",
        description: `끄코 유틸리티 - 관리자 페이지`,
        openGraph: {
            title: "끄코 유틸리티 - 관리자 페이지",
            description: "끄코 유틸리티 - 관리자 페이지",
            type: "website",
            url: "https://kkuko-utils.vercel.app/admin/api-server",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function Page() {
    return <ApiServerManagerHome />;
}