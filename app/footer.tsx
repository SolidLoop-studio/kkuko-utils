import Link from 'next/link';
import { Bug, FileText, ExternalLink } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex-shrink-0 relative overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
      <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-gray-600/30 to-transparent"></div>
      <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-gray-600/30 to-transparent"></div>
      
      <div className="container mx-auto px-6 py-12 relative z-10">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-8 lg:space-y-0">
          
          {/* 브랜드 섹션 */}
          <div className="lg:flex lg:flex-col lg:items-start gap-2">
            <Link href="/" className="group inline-block">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent group-hover:from-blue-300 group-hover:to-purple-300 transition-all duration-300">
                Kkuko Utils
              </h2>
            </Link>

            <a
              href="https://kkutu.lightstudio.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="
                text-sm text-gray-300 hover:text-white transition-colors
                px-2 py-1 rounded-lg
                bg-white/5 hover:bg-white/10
                border border-white/10
              "
            >
              파트너: kkutu.lightstudio.kr
            </a>
        </div>

          {/* 링크 섹션 */}
          <div className="lg:flex-1 lg:max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">바로가기</h3>
            <nav className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href="https://github.com/hafskjfha/kkuko-utils"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
              >
                <span className="text-sm font-medium group-hover:text-white transition-colors">GitHub</span>
                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300 ml-auto transition-colors" />
              </a>
              
              <a
                href="https://github.com/hafskjfha/kkuko-utils?tab=readme-ov-file#%EB%B2%84%EA%B7%B8-%EC%8B%A0%EA%B3%A0--%EA%B8%B0%EB%8A%A5-%EC%B6%94%EA%B0%80-%EC%9A%94%EC%B2%AD-bug-report--feature-suggestions"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
              >
                <Bug className="w-5 h-5 text-gray-400 group-hover:text-red-400 transition-colors" />
                <span className="text-sm font-medium group-hover:text-white transition-colors">Bug Report</span>
                <ExternalLink className="w-3 h-3 text-gray-500 group-hover:text-gray-300 ml-auto transition-colors" />
              </a>
              
              <Link
                href="/release-note"
                className="group flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50 sm:col-span-2"
              >
                <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" />
                <span className="text-sm font-medium group-hover:text-white transition-colors">Release Notes</span>
              </Link>
              
              <Link
                href="/terms"
                className="group flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
              >
                <FileText className="w-5 h-5 text-gray-400 group-hover:text-green-400 transition-colors" />
                <span className="text-sm font-medium group-hover:text-white transition-colors">서비스 약관</span>
              </Link>
              
              <Link
                href="/privacy"
                className="group flex items-center space-x-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 border border-gray-700/50 hover:border-gray-600/50"
              >
                <FileText className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                <span className="text-sm font-medium group-hover:text-white transition-colors">개인정보처리방침</span>
              </Link>
            </nav>
          </div>
        </div>

        {/* 구분선 */}
        <div className="relative mt-12">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gradient-to-r from-transparent via-gray-600/30 to-transparent"></div>
          </div>
          <div className="relative flex justify-center">
            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center border border-gray-600/30">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* 저작권 섹션 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} 
            <span className="font-medium text-gray-300 mx-1">hafskjfha</span>
            All rights reserved.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Made with ❤️ for developers
          </p>
        </div>
      </div>
      
      {/* 하단 글로우 효과 */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
    </footer>
  );
};

export default Footer;