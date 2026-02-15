"use client";
import Link from "next/link";
import { FileText, Settings, ArrowRight, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col items-center justify-start">
      {/* 제목 영역 */}
      <header className="text-center mt-16 px-4 relative">
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
          단어장 관리 도구
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          효율적인 단어장 관리를 위한 도구입니다. 원하는 작업을 선택해보세요.
        </p>
      </header>

      {/* 기능 설명 영역 */}
      <main className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 px-4 w-full max-w-6xl">
        {/* 추출계열 */}
        <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-8 shadow-xl dark:shadow-2xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-2xl dark:hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">
            추출 도구
          </h2>
          
          <p className="text-slate-600 dark:text-slate-300 mb-6 text-center leading-relaxed">
            텍스트파일 합치기, 미션단어 및 돌림단어 추출 등 다양한 텍스트 처리 기능을 제공합니다.
          </p>
          
          <div className="space-y-2 mb-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
              파일 병합
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
              특정 패턴 단어 추출
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
              등등
            </div>
          </div>
          
          <Link href="/manager-tool/extract" className="block">
            <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group">
              시작하기
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </Link>
        </div>

        {/* 정리 계열 */}
        <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-8 shadow-xl dark:shadow-2xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-2xl dark:hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Settings className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">
            정리 도구
          </h2>
          
          <p className="text-slate-600 dark:text-slate-300 mb-6 text-center leading-relaxed">
            단어장 정렬, 중복 제거, 텍스트 치환 등 체계적인 데이터 정리 기능을 제공합니다.
          </p>
          
          <div className="space-y-2 mb-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
              알파벳순 자동 정렬
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
              중복 항목 제거
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3"></div>
              텍스트 일괄 변환
            </div>
          </div>
          
          <Link href="/manager-tool/arrange" className="block">
            <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group">
              시작하기
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
          </Link>
        </div>
      </main>

      
    </div>
  );
}