"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 py-16 text-center">
      <div className="w-full max-w-md mx-auto">
        {/* Error Icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <AlertTriangle
              size={60}
              className="text-red-500 dark:text-red-400"
            />
            
          </div>
        </div>

        {/* Error Message */}
        <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 mb-2">
          404
        </h1>

        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          페이지를 찾을 수 없습니다
        </h2>

        <p className="text-gray-600 dark:text-gray-400 text-lg mb-8">
          요청하신 페이지가 삭제되었거나 주소가 변경되었을 수 있습니다.
        </p>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 w-24 mx-auto mb-8"></div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={goBack}
            className="flex items-center justify-center gap-2 px-5 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-md hover:shadow-lg"
          >
            <ArrowLeft size={18} />
            이전 페이지로 돌아가기
          </button>

          <button
            onClick={() => router.push("/")}
            className="px-5 py-3 text-base font-medium text-blue-600 bg-white border border-blue-600 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-gray-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-sm hover:shadow"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}
