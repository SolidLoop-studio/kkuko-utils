import Link from "next/link";
import { Home as HomeIcon, Book, Layers, Zap } from "lucide-react";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <header className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
            끄코 도구 (kkuko-utils)
          </h1>
          <p className="mt-4 text-lg sm:text-xl max-w-2xl mx-auto text-blue-100">
            끄코 사용자가 편리할 수 있게 하는 도구 웹사이트
          </p>
        </div>
      </header>

      {/* Features Section */}
      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            기능 (Features)
          </h2>
          <div className="mt-2 h-1 w-20 bg-blue-500 mx-auto rounded-full"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <Link href="/word-combiner">
            <div className="group h-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-transparent hover:border-blue-300 dark:hover:border-blue-600">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                    <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                    단어 조합기
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  글자 조각으로 6, 5글자 조합하여 낱장, 휘장 상자 획득.
                </p>
                <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 font-medium">
                  <span>바로가기</span>
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/manager-tool">
            <div className="group h-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-transparent hover:border-blue-300 dark:hover:border-blue-600">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg">
                    <Book className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                    단어장 정리 도구
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  글자순 정렬 및 특정 단어 추출 등 정리 도구 제공.
                </p>
                <div className="mt-4 flex items-center text-green-600 dark:text-green-400 font-medium">
                  <span>바로가기</span>
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/words-docs">
            <div className="group h-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-transparent hover:border-blue-300 dark:hover:border-blue-600">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg">
                    <HomeIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                    단어장 게시
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  단어장을 공유하고 사용하며 수정할 수 있게 하는 기능.
                </p>
                <div className="mt-4 flex items-center text-purple-600 dark:text-purple-400 font-medium">
                  <span>바로가기</span>
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/extra-features">
            <div className="group h-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-transparent hover:border-blue-300 dark:hover:border-blue-600">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="bg-amber-100 dark:bg-amber-900 p-3 rounded-lg">
                    <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">
                    기타 기능
                  </h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300">
                  기타 기능. 오픈 DB확인, 타자연습(추가예정) 등.
                </p>
                <div className="mt-4 flex items-center text-amber-600 dark:text-amber-400 font-medium">
                  <span>바로가기</span>
                  <svg
                    className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14"></path>
                    <path d="M12 5l7 7-7 7"></path>
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Home;
