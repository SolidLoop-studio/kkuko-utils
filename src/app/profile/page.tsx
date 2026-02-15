import ProfileHomePage from "./ProfileHome";

export async function generateMetadata() {
    return {
        title: `끄코 유틸리티 - 프로필 페이지`,
        description: `끄코 유틸리티 - 프로필 페이지 홈`,
        openGraph: {
            title: "끄코 유틸리티 - 프로필 페이지",
            description: "끄코 유틸리티 - 프로필 페이지 홈",
            type: "website",
            url: "https://kkuko-utils.vercel.app/profile",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    }
}

export default function ProfilePageA() {
    return (
        <ProfileHomePage />
    );
}
