import Link from "next/link";
import {
    Search,
    Download,
    Plus,
    Upload,
    FileText,
    Clock,
    ChevronRight,
    Database,
    BarChart3, AlignStartVertical
} from "lucide-react";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 오픈DB",
        description: `끄코 유틸리티 - 오픈DB 홈`,
        openGraph: {
            title: "끄코 유틸리티 - 오픈DB",
            description: "끄코 유틸리티 - 오픈DB 홈",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const features = [
    { 
        title: "단어 검색", 
        description: "DB에 저장된 단어를 검색합니다.", 
        link: "/word/search",
        icon: Search,
        color: "from-blue-500 to-cyan-500",
        bgColor: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20"
    },
    { 
        title: "DB 다운로드", 
        description: "오픈DB의 단어들을 필터링해 다운로드합니다.", 
        link: "/word/words-download",
        icon: Download,
        color: "from-emerald-500 to-green-500",
        bgColor: "group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/20"
    },
    { 
        title: "단어 추가", 
        description: "새로운 단어를 오픈DB에 등록합니다.", 
        link: "/word/add",
        icon: Plus,
        color: "from-purple-500 to-violet-500",
        bgColor: "group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20"
    },
    { 
        title: "단어 대량 추가", 
        description: "새로운 단어를 오픈DB에 등록합니다. (tsv,txt,json)", 
        link: "/word/adds",
        icon: Upload,
        color: "from-orange-500 to-red-500",
        bgColor: "group-hover:bg-orange-50 dark:group-hover:bg-orange-950/20"
    },
    { 
        title: "단어 로그", 
        description: "단어의 최근 로그를 확인합니다.", 
        link: "/word/logs",
        icon: FileText,
        color: "from-teal-500 to-cyan-500",
        bgColor: "group-hover:bg-teal-50 dark:group-hover:bg-teal-950/20"
    },
    { 
        title: "요청 대기 현황", 
        description: "추가/삭제 요청 대기 목록을 확인합니다.", 
        link: "/word/requests",
        icon: Clock,
        color: "from-pink-500 to-rose-500",
        bgColor: "group-hover:bg-pink-50 dark:group-hover:bg-pink-950/20"
    },
    { 
        title: "단어 통계", 
        description: "글자별 단어 개수 통계를 확인합니다.", 
        link: "/word/stats",
        icon: BarChart3,
        color: "from-indigo-500 to-blue-500",
        bgColor: "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20"
    },
    {
        title: "Open API",
        description: "오픈 DB의 단어 검색 기능을 API에서 만나보세요.",
        link: "/word/api",
        icon: AlignStartVertical,
        color: "from-indigo-400 to-yellow-600",
        bgColor: "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20"
    }
];

export default function OpenDBHomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 p-6">
            {/* 헤더 */}
            <div className="max-w-7xl mx-auto mb-12">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <Database className="w-8 h-8 text-indigo-500 mr-3" />
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                            한국어 오픈DB 관리
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
                        단어 데이터베이스를 활용하세요
                    </p>
                </div>

                {/* 기능 카드 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
                    {features.map((feature, idx) => {
                        const IconComponent = feature.icon;
                        
                        return (
                            <Link key={idx} href={feature.link}>
                                <div className={`group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-2xl dark:hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer ${feature.bgColor}`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                            <IconComponent className="w-6 h-6 text-white" />
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300" />
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                                        {feature.title}
                                    </h3>
                                    
                                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                                        {feature.description}
                                    </p>
                                    
                                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors duration-300">
                                            시작하기 →
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}