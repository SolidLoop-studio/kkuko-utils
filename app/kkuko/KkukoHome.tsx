"use client";
import { ArrowRight, Trophy, User } from "lucide-react";
import Link from "next/link";

export default function KkukoHome() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col items-center justify-start">
            {/* 제목 영역 */}
            <header className="text-center mt-16 px-4 relative">
                <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                    끄코 정보
                </h1>
                <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                    끄투코리아의 유저정보와 랭킹을 조회 할 수 있습니다.
                </p>
            </header>

            {/* 기능 설명 영역 */}
            <main className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8 px-4 w-full max-w-6xl">
                {/* 프로필 */}
                <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-8 shadow-xl dark:shadow-2xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-2xl dark:hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-center mb-6">
                        <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <User className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">
                        프로필
                    </h2>

                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-center leading-relaxed">
                        끄투코리아의 유저 정보와 전적 등을 확인할 수 있습니다.
                    </p>

                    <Link href="/kkuko/profile" className="block">
                        <button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group">
                            둘러보기
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                        </button>
                    </Link>
                </div>

                {/* 랭킹*/}
                <div className="group bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-8 shadow-xl dark:shadow-2xl rounded-2xl border border-slate-200/50 dark:border-slate-700/50 hover:shadow-2xl dark:hover:shadow-emerald-500/10 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center justify-center mb-6">
                        <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <Trophy className="w-8 h-8 text-white" />
                        </div>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4 text-center">
                        랭킹
                    </h2>

                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-center leading-relaxed">
                        각 모드별로 승리가 많은 유저들의 랭킹을 확인할 수 있습니다.
                    </p>

                    <Link href="/kkuko/ranking?mode=KSH" className="block">
                        <button className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group">
                            구경하기
                            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                        </button>
                    </Link>
                </div>
            </main>
        </div>
    )
}