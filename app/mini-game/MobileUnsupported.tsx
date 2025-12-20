"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Monitor } from "lucide-react";

const MobileUnsupported = () => {
    const router = useRouter();

    return (
        <div className="flex md:hidden justify-center items-center min-h-[60vh] px-4">
            <div className="max-w-md w-full">
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
                    {/* Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full">
                            <Monitor className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-3">
                        PC 환경에서 이용해주세요
                    </h2>

                    {/* Description */}
                    <p className="text-center text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
                        이 게임은 모바일 환경을 지원하지 않습니다.
                        <br />
                        데스크톱이나 태블릿에서 접속해주세요.
                    </p>

                    {/* Back Button */}
                    <button
                        onClick={() => router.back()}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span>뒤로가기</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MobileUnsupported;