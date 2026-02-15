import UsersList from "./UsersList";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 사용자 관리",
        description: `끄코 유틸리티 - 사용자 관리`,
        openGraph: {
            title: "끄코 유틸리티 - 사용자 관리",
            description: "끄코 유틸리티 - 사용자 관리",
            type: "website",
            url: "https://kkuko-utils.vercel.app/admin/users",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function UsersPage(){
    return <UsersList />
}
