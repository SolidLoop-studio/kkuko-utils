import { Metadata } from "next";
import AdminLogsWrapper from "./AdminLogsWrapper";

export const metadata: Metadata = {
    title: "끄코 유틸 - 관리자 로그 관리",
    description: "관리자 로그 관리 페이지",
};

export default async function AdminLogsPage() {
    return <AdminLogsWrapper />;
}
