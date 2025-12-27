import {AlignStartVertical, ChevronRight, DoorOpen} from "lucide-react";
import Link from "next/link";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 오픈API",
        description: `끄코 유틸리티 - 오픈API 홈`,
        openGraph: {
            title: "끄코 유틸리티 - 오픈API",
            description: "끄코 유틸리티 - 오픈API 홈",
            type: "website",
            url: "https://kkuko-utils.vercel.app/openapi",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const features = [
    {
        title: "Word Search API",
        description: "단어 검색 기능을 API에서 만나보세요.",
        link: "/openapi/word",
        icon: AlignStartVertical,
        color: "from-indigo-400 to-yellow-600",
        bgColor: "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20"
    }
]

export default function OpenAPIHomePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 p-6">
            {/* 헤더 */}
            <div className="max-w-7xl mx-auto mb-12">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <DoorOpen className="w-8 h-8 text-indigo-500 mr-3" />
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                            오픈 API
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
                        끄코 유틸리티의 기능을 API에서 만나보세요.
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