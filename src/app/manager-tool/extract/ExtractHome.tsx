"use client";
import React from "react";
import Link from "next/link";
import { 
  Type, 
  Hash, 
  ArrowRight, 
  RotateCcw, 
  Merge, 
  FileText, 
  Globe, 
  Star,
  HelpCircle,
  Sparkles,
  ChevronRight
} from "lucide-react";

const ExtractHome: React.FC = () => {
  const menuItems = [
    { 
      id: 1, 
      name: "X글자수 단어 추출", 
      description: "특정 길이의 단어들을 필터링하여 추출합니다.", 
      link: "/lenx",
      icon: Hash,
      color: "from-blue-500 to-cyan-500",
      bgColor: "group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20"
    },
    { 
      id: 2, 
      name: "X로 시작하는 단어 추출", 
      description: "지정된 문자열로 시작하는 모든 단어를 추출합니다.", 
      link: "/startx",
      icon: ArrowRight,
      color: "from-emerald-500 to-green-500",
      bgColor: "group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/20"
    },
    { 
      id: 3, 
      name: "X로 끝나는 단어 추출", 
      description: "특정 접미사나 끝글자로 마무리되는 단어들을 추출합니다.", 
      link: "/endx",
      icon: Type,
      color: "from-purple-500 to-violet-500",
      bgColor: "group-hover:bg-purple-50 dark:group-hover:bg-purple-950/20"
    },
    { 
      id: 4, 
      name: "돌림단어 추출", 
      description: "회문이나 대칭 구조를 가진 특별한 단어들을 추출합니다.", 
      link: "/loop",
      icon: RotateCcw,
      color: "from-orange-500 to-red-500",
      bgColor: "group-hover:bg-orange-50 dark:group-hover:bg-orange-950/20"
    },
    { 
      id: 5, 
      name: "파일 합성", 
      description: "여러 텍스트 파일을 하나로 병합시킵니다.", 
      link: "/merge",
      icon: Merge,
      color: "from-teal-500 to-cyan-500",
      bgColor: "group-hover:bg-teal-50 dark:group-hover:bg-teal-950/20"
    },
    { 
      id: 6, 
      name: "한국어 미션단어 추출 - A", 
      description: "한국어 텍스트에서 미션 조건에 맞는 단어들을 추출합니다.", 
      link: "/korean-mission",
      icon: FileText,
      color: "from-pink-500 to-rose-500",
      bgColor: "group-hover:bg-pink-50 dark:group-hover:bg-pink-950/20"
    },
    { 
      id: 7, 
      name: "영어 미션단어 추출", 
      description: "영어 텍스트에서 미션 조건을 만족하는 단어들을 추출합니다.", 
      link: "/english-mission",
      icon: Globe,
      color: "from-indigo-500 to-blue-500",
      bgColor: "group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/20"
    },
    { 
      id: 8, 
      name: "한국어 미션단어 추출 - B", 
      description: "1티어 미션단어만을 선별하여 단어를 추출합니다.", 
      link: "/korean-mission-b",
      icon: Star,
      color: "from-yellow-500 to-amber-500",
      bgColor: "group-hover:bg-yellow-50 dark:group-hover:bg-yellow-950/20"
    },
    { 
      id: 9, 
      name: "기능 제안하기", 
      description: "새로운 기능이 필요하시다면 언제든 요청해주세요!",
      icon: HelpCircle,
      color: "from-gray-500 to-slate-500",
      bgColor: "group-hover:bg-gray-50 dark:group-hover:bg-gray-950/20"
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 p-6">
      {/* 헤더 */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-indigo-500 mr-3" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
              텍스트 추출 도구
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
            다양한 조건으로 텍스트에서 원하는 단어들을 추출하세요
          </p>
        </div>

        {/* 기능 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            
            return item.link ? (
              <Link key={item.id} href={`/manager-tool/extract${item.link}`}>
                <div className={`group bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-2xl dark:hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 cursor-pointer ${item.bgColor}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${item.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors duration-300">
                    {item.name}
                  </h3>
                  
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                    {item.description}
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
                key={item.id}
                className={`group bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-xl border border-slate-200/50 dark:border-slate-700/50 p-6 hover:shadow-xl transition-all duration-300 cursor-pointer ${item.bgColor}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${item.color} shadow-lg opacity-75`}>
                    <IconComponent className="w-6 h-6 text-white" />
                  </div>
                  <HelpCircle className="w-5 h-5 text-slate-400" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-3">
                  {item.name}
                </h3>
                
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  {item.description}
                </p>
                
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    곧 출시 예정
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 하단 정보 */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center px-6 py-3 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm rounded-full shadow-lg border border-slate-200/50 dark:border-slate-700/50">
            <FileText className="w-5 h-5 text-indigo-500 mr-2" />
            <span className="text-slate-600 dark:text-slate-300 text-sm font-medium">
              총 {menuItems.filter(item => item.link).length}개의 추출 도구 이용 가능
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtractHome;