import Link from "next/link";
import { Database, Gamepad2, ChevronRight, Sparkles, Monitor, BarChart3 } from "lucide-react";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 기타 기능",
        description: `끄코 유틸리티 - 기타 기능 홈`,
        openGraph: {
            title: "끄코 유틸리티 - 기타 기능",
            description: "끄코 유틸리티 - 기타 기능 홈",
            type: "website",
            url: "https://kkuko-utils.vercel.app/extra-features",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

const features = [
    { 
        title: "오픈 DB", 
        description: "단어 오픈 데이터베이스를 확인 및 활용하세요.", 
        link: "/word",
        icon: Database,
        color: "from-blue-500 to-cyan-500",
        bgColor: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20"
    },
    { 
        title: "미니게임", 
        description: "다양한 미니게임을 하며 실력을 늘려보세요.", 
        link: '/mini-game',
        icon: Gamepad2,
        color: "from-purple-500 to-pink-500",
        bgColor: "group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20"
    },
    {
        title: "유용한 프로그램",
        description: "다양한 유용한 프로그램을 확인하고 활용하세요.",
        link: "/programs",
        icon: Monitor,
        color: "from-gray-500 to-gray-600",
        bgColor: "group-hover:bg-gray-50 dark:group-hover:bg-gray-950/20"
    }, 
    {
        title: "리플레이 분석기",
        description: "게임 리플레이 데이터를 분석하고 통계 정보를 제공합니다.",
        link: "/replay-analyzer",
        icon: BarChart3,
        color: "from-orange-500 to-orange-600",
        bgColor: "group-hover:bg-orange-50 dark:group-hover:bg-orange-950/20"
    }
];

export default function ExtraFeaturesPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 p-6">
            {/* 헤더 */}
            <div className="max-w-7xl mx-auto mb-12">
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-indigo-500 mr-3" />
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                            추가 기능
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
                        메인기능 외에도 다양한 유틸리티 기능을 제공합니다.
                    </p>
                </div>

                {/* 기능 카드 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {features.map((feature, index) => {
                        const IconComponent = feature.icon;
                        
                        return feature.link ? (
                            <Link key={index} href={feature.link}>
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
                        ) : (
                            <div
                                key={index}
                                className={`group bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer ${feature.bgColor}`}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${feature.color} shadow-lg opacity-75`}>
                                        <IconComponent className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                                
                                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-3">
                                    {feature.title}
                                </h3>
                                
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                    {feature.description}
                                </p>
                                
                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        제작 예정
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}