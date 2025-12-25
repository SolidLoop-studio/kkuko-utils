import {
    AlertCircle,
    Code,
    List,
    Search,
    Settings,
    Terminal,
    Braces,
    FileJson
} from "lucide-react";

export async function generateMetadata() {
    return {
        title: "끄코 유틸리티 - 오픈DB API",
        description: `끄코 유틸리티 - 오픈DB API`,
        openGraph: {
            title: "끄코 유틸리티 - 오픈DB API",
            description: "끄코 유틸리티 - 오픈DB API",
            type: "website",
            url: "https://kkuko-utils.vercel.app/word/api",
            siteName: "끄코 유틸리티",
            locale: "ko_KR",
        },
    };
}

export default function OpenAPIDocsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 p-6">
            <div className="max-w-5xl mx-auto mb-12">
                <div className="text-center mb-12">
                    <div className="flex items-center justify-center mb-4">
                        <Code className="w-10 h-10 text-indigo-500 mr-3" />
                        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                            Open API
                        </h1>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-lg max-w-2xl mx-auto">
                        오픈 DB의 단어 검색 기능을 API에서 만나보세요.
                    </p>
                </div>

                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8 mb-8 transition-all">
                    <div className="flex items-center mb-6">
                        <div className="p-2 rounded-lg bg-blue-500/10 mr-4">
                            <Terminal className="w-6 h-6 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">기본 정보</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 bg-slate-100 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <span className="px-3 py-1 bg-blue-500 text-white text-sm font-bold rounded-lg">GET</span>
                        <code className="text-indigo-600 dark:text-indigo-400 font-mono text-lg break-all">
                            /api/words/search
                        </code>
                    </div>
                    <p className="mt-4 text-slate-600 dark:text-slate-400 text-sm">
                        모드별 필터링 및 정렬 옵션을 적용하여 오픈DB의 단어 리스트를 반환합니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 mb-8">
                    <section className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
                        <div className="flex items-center mb-8">
                            <div className="p-2 rounded-lg bg-purple-500/10 mr-4">
                                <List className="w-6 h-6 text-purple-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">쿼리 파라미터</h2>
                        </div>

                        <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-4 flex items-center">
                            <Search className="w-4 h-4 mr-2" /> 1. 필수 및 공통 옵션
                        </h3>
                        <div className="overflow-x-auto mb-10">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-3 px-4 text-slate-500 font-semibold">파라미터</th>
                                    <th className="py-3 px-4 text-slate-500 font-semibold">타입</th>
                                    <th className="py-3 px-4 text-slate-500 font-semibold">설명</th>
                                    <th className="py-3 px-4 text-slate-500 font-semibold">기본값</th>
                                </tr>
                                </thead>
                                <tbody className="text-slate-700 dark:text-slate-300">
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-4 px-4 font-mono text-indigo-500 font-bold">mode</td>
                                    <td className="py-4 px-4">string</td>
                                    <td className="py-4 px-4">게임 모드 (kor-start, kor-end, kung, hunmin, jaqi)</td>
                                    <td className="py-4 px-4 italic">kor-start</td>
                                </tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-4 px-4 font-mono text-indigo-500 font-bold">q</td>
                                    <td className="py-4 px-4 text-rose-500 font-bold">string</td>
                                    <td className="py-4 px-4 font-bold">검색어. 모드에 따라 시작자, 끝자, 또는 초성</td>
                                    <td className="py-4 px-4">-</td>
                                </tr>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <td className="py-4 px-4 font-mono text-indigo-500 font-bold">limit</td>
                                    <td className="py-4 px-4">number</td>
                                    <td className="py-4 px-4">최대 검색 결과 수</td>
                                    <td className="py-4 px-4">100</td>
                                </tr>
                                <tr>
                                    <td className="py-4 px-4 font-mono text-indigo-500 font-bold">sortBy</td>
                                    <td className="py-4 px-4">string</td>
                                    <td className="py-4 px-4">정렬 기준 (abc, length, attack)</td>
                                    <td className="py-4 px-4">length</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-4 flex items-center">
                            <Settings className="w-4 h-4 mr-2" /> 2. 세부 필터링 (Advanced)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-3 px-4 text-slate-500 font-semibold">파라미터</th>
                                    <th className="py-3 px-4 text-slate-500 font-semibold">타입</th>
                                    <th className="py-3 px-4 text-slate-500 font-semibold">설명</th>
                                    <th className="py-3 px-4 text-slate-500 font-semibold">기본값</th>
                                </tr>
                                </thead>
                                <tbody className="text-slate-700 dark:text-slate-300">
                                {[
                                    { p: "manner", t: "string", d: "단어 필터 (man, jen, eti)", v: "man" },
                                    { p: "minLength", t: "number", d: "최소 글자 수", v: "2" },
                                    { p: "maxLength", t: "number", d: "최대 글자 수", v: "100" },
                                    { p: "duem", t: "boolean", d: "두음법칙 적용 여부", v: "true" },
                                    { p: "mission", t: "string", d: "포함해야 할 특정 글자", v: '""' },
                                    { p: "themeId", t: "number", d: "jaqi 모드 사용 시 필수 테마 ID", v: "-" },
                                ].map((row, i) => (
                                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        <td className="py-4 px-4 font-mono text-emerald-500 font-bold">{row.p}</td>
                                        <td className="py-4 px-4">{row.t}</td>
                                        <td className="py-4 px-4">{row.d}</td>
                                        <td className="py-4 px-4 italic">{row.v}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <section className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-8">
                        <div className="flex items-center mb-6">
                            <div className="p-2 rounded-lg bg-indigo-500/10 mr-4">
                                <Braces className="w-6 h-6 text-indigo-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Response Body</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="text-sm font-bold text-indigo-600 mb-2">Success (Array)</h4>
                                <ul className="space-y-3">
                                    <li className="flex flex-col">
                                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">word: string</span>
                                        <span className="text-xs text-slate-500 font-medium leading-relaxed">검색된 단어의 명칭</span>
                                    </li>
                                    <li className="flex flex-col">
                                        <span className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">nextWordCount: number</span>
                                        <span className="text-xs text-slate-500 font-medium leading-relaxed">해당 단어 이후에 이어질 수 있는 단어의 개수</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    <section className="bg-slate-900 rounded-3xl shadow-lg p-8">
                        <div className="flex items-center mb-6">
                            <FileJson className="w-6 h-6 text-indigo-400 mr-4" />
                            <h2 className="text-2xl font-bold text-white font-mono">Example</h2>
                        </div>
                        <pre className="text-xs md:text-sm font-mono text-indigo-300 leading-relaxed overflow-x-auto">
{`[
  {
    "word": "사과",
    "nextWordCount": 15
  },
  {
    "word": "해질녘",
    "nextWordCount": 0
  }
]`}
                        </pre>
                    </section>
                </div>

                <div className="bg-slate-900 rounded-3xl shadow-2xl p-8 mb-8 text-slate-100">
                    <div className="flex items-center mb-8">
                        <Terminal className="w-6 h-6 text-emerald-400 mr-4" />
                        <h2 className="text-2xl font-bold">API 사용 예제</h2>
                    </div>

                    <div className="space-y-6 font-mono text-sm">
                        <div className="space-y-2">
                            <p className="text-slate-400">A. 일반적인 끝말잇기 (시작 단어 찾기)</p>
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-x-auto">
                                <span className="text-emerald-400 font-bold">GET</span> /api/words/search?mode=kor-start&q=가&manner=man&limit=50&sortBy=length
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-slate-400">B. 쿵쿵따 모드</p>
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-x-auto">
                                <span className="text-emerald-400 font-bold">GET</span> /api/words/search?mode=kung&q=나
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-slate-400">C. 훈민정음 (초성 퀴즈)</p>
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 overflow-x-auto">
                                <span className="text-emerald-400 font-bold">GET</span> /api/words/search?mode=hunmin&q=ㄱㄴ
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-rose-50 dark:bg-rose-950/20 rounded-3xl p-8 border border-rose-200/50 dark:border-rose-900/50">
                    <div className="flex items-center mb-6">
                        <AlertCircle className="w-6 h-6 text-rose-500 mr-4" />
                        <h2 className="text-2xl font-bold text-rose-800 dark:text-rose-200">Response Status Code</h2>
                    </div>
                    <ul className="space-y-4">
                        <li className="flex items-start">
                            <span className="font-bold text-rose-600 mr-4 w-12">200:</span>
                            <span className="text-slate-700 dark:text-slate-300 text-sm">OK</span>
                        </li>
                        <li className="flex items-start">
                            <span className="font-bold text-rose-600 mr-4 w-12">400:</span>
                            <div>
                                <span className="text-slate-700 dark:text-slate-300 text-sm font-bold block mb-1">Bad Request</span>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">필수 파라미터 누락 또는 유효하지 않은 요청</p>
                            </div>
                        </li>
                        <li className="flex items-start">
                            <span className="font-bold text-rose-600 mr-4 w-12">500:</span>
                            <span className="text-slate-700 dark:text-slate-300 text-sm">Internal Server Error</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}