"use client";
import Link from "next/link";
import { Calendar, Clock, User, FileText, Tag, ArrowLeft, Star, Eye, TrendingUp } from "lucide-react";

interface Metadata {
    id: number;
    created_at: string;
    name: string;
    users: {
        nickname: string;
    } | null;
    typez: "letter" | "theme" | "ect";
    last_update: string;
    views: number;
};

const DocsInfo = ({ 
    metaData, 
    wordsCount, 
    starCount, 
    docsViewRank 
}: { 
    metaData: Metadata; 
    wordsCount: number; 
    starCount: number; 
    docsViewRank: number;
}) => {
    const lastUpdateDate = new Date(metaData.last_update);
    const createdAtDate = new Date(metaData.created_at);
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // 날짜 포맷팅 개선
    const formatDate = (date: Date) => {
        return date.toLocaleString(undefined, {
            timeZone: userTimeZone,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // 문서 유형에 따른 색상 설정
    const getTypeColor = (type: string) => {
        switch (type) {
            case "letter":
                return "bg-indigo-100 text-indigo-800";
            case "theme":
                return "bg-emerald-100 text-emerald-800";
            default:
                return "bg-amber-100 text-amber-800";
        }
    };

    // 유형에 따른 한국어 텍스트 설정
    const getTypeText = (type: string) => {
        switch (type) {
            case "letter":
                return "letter";
            case "theme":
                return "theme";
            default:
                return "ect";
        }
    };

    return (
        <div className="min-h-screen max-w-6xl mx-auto px-4 py-8 space-y-8 bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
            {/* 이전 페이지로 돌아가기 */}
            <Link
                href={`/words-docs/${metaData.id}`}
                className="flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
                <ArrowLeft size={18} className="mr-2" />
                <span>문서로 돌아가기</span>
            </Link>

            {/* 헤더 섹션 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 gap-3">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">{metaData.name}</h1>
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${getTypeColor(metaData.typez)}`}>
                            {getTypeText(metaData.typez)}
                        </span>
                    </div>
                    {metaData.users && (
                        <Link
                            href={`/profile/${metaData.users.nickname}`}
                            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-full px-3 py-1 transition-colors"
                        >
                            <User size={16} className="text-gray-600 dark:text-gray-300" />
                            <span className="font-medium text-gray-800 dark:text-gray-100">{metaData.users.nickname}</span>
                        </Link>
                    )}
                </div>

                {/* 메타데이터 섹션 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mt-6">
                    {/* 생성일 */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Calendar size={20} className="text-indigo-600 dark:text-indigo-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">생성일</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{formatDate(createdAtDate)}</p>
                        </div>
                    </div>

                    {/* 마지막 업데이트 */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Clock size={20} className="text-emerald-600 dark:text-emerald-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">마지막 업데이트</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{formatDate(lastUpdateDate)}</p>
                        </div>
                    </div>

                    {/* 단어 개수 */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <FileText size={20} className="text-amber-600 dark:text-amber-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">단어 개수</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{new Intl.NumberFormat().format(wordsCount)}개</p>
                        </div>
                    </div>

                    {/* 즐겨찾기 수 */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Star size={20} className="text-yellow-600 dark:text-yellow-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">즐겨찾기</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{new Intl.NumberFormat().format(starCount)}명</p>
                        </div>
                    </div>

                    {/* 문서 ID */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Tag size={20} className="text-rose-600 dark:text-rose-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">문서 ID</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{metaData.id}</p>
                        </div>
                    </div>

                    {/* 조회수 */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <Eye size={20} className="text-blue-600 dark:text-blue-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">조회수</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{new Intl.NumberFormat().format(metaData.views)}회</p>
                        </div>
                    </div>

                    {/* 조회수 랭킹 */}
                    <div className="flex items-start gap-3 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <TrendingUp size={20} className="text-purple-600 dark:text-purple-400 mt-1" />
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">조회수 랭킹</p>
                            <p className="text-base text-gray-800 dark:text-gray-100">{docsViewRank}위</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocsInfo;