"use client";
import HelpModal from '../components/HelpModal';
import React, { useEffect, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Play } from 'lucide-react';

const HelpModalA = ({ wantGo }: { wantGo?: 1 | 2 | 3; }) => {
    // 각 섹션에 대한 ref
    const normalHelp = useRef<HTMLHeadingElement>(null);
    const HTMLHelp = useRef<HTMLHeadingElement>(null);
    const chromeHTML = useRef<HTMLHeadingElement>(null);

    const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        if (wantGo) {
            switch (wantGo) {
                case 3:
                    scrollToSection(HTMLHelp);
                    break;
            }
        }
    }, [wantGo]);

    return (
        <div className="space-y-6">
            {/* 목차 */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 text-blue-800 dark:text-blue-200">목차</h4>
                <ul className="space-y-2">
                    <li>
                        <button
                            className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                            onClick={() => scrollToSection(normalHelp)}
                        >
                            1. 기본적인 사용법
                        </button>
                    </li>
                    <li>
                        <button
                            className="text-blue-600 dark:text-blue-400 hover:underline text-left"
                            onClick={() => scrollToSection(HTMLHelp)}
                        >
                            2. HTML 입력창 사용법
                        </button>
                        <ul className="ml-4 mt-1 space-y-1">
                            <li>
                                <button
                                    className="text-blue-500 dark:text-blue-300 hover:underline text-left text-sm"
                                    onClick={() => scrollToSection(chromeHTML)}
                                >
                                    • 구글 크롬(Chrome) 사용법
                                </button>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>

            {/* 기본 사용법 */}
            <div className="space-y-4">
                <h3 ref={normalHelp} className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm px-2 py-1 rounded-full font-medium">1</span>
                    기본적인 사용법
                </h3>

                {/* Step 1: 글자조각 입력 */}
                <div className="space-y-3 ml-6">
                    <div className="flex items-center gap-2">
                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full font-medium">1</span>
                        <h4 className="font-semibold">글자조각 입력</h4>
                    </div>
                    <div className="ml-6 space-y-2">
                        <p className="text-gray-700 dark:text-gray-300">원하는 탭을 선택하고 글자조각을 입력합니다.</p>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                            <div className="space-y-2">
                                <div className="flex space-x-2">
                                    <Button variant="outline" size="sm" className="text-xs" disabled>일반 글자조각</Button>
                                    <Button variant="ghost" size="sm" className="text-xs" disabled>고급 글자조각</Button>
                                    <Button variant="ghost" size="sm" className="text-xs" disabled>희귀 글자조각</Button>
                                </div>
                                <textarea
                                    placeholder="글자조각을 입력하세요..."
                                    className="w-full h-20 p-2 border rounded text-sm resize-none"
                                    disabled
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 2: 조합 실행 */}
                <div className="space-y-3 ml-6">
                    <div className="flex items-center gap-2">
                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full font-medium">2</span>
                        <h4 className="font-semibold">조합 실행</h4>
                    </div>
                    <div className="ml-6 space-y-2">
                        <p className="text-gray-700 dark:text-gray-300">조합하기 버튼을 클릭하여 단어를 생성합니다.</p>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                            <Button className="h-8" disabled>
                                <Play className="w-3 h-3 mr-2" />
                                조합하기
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Step 3: 결과 확인 */}
                <div className="space-y-3 ml-6">
                    <div className="flex items-center gap-2">
                        <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded-full font-medium">3</span>
                        <h4 className="font-semibold">결과 확인</h4>
                    </div>
                    <div className="ml-6 space-y-2">
                        <p className="text-gray-700 dark:text-gray-300">오른쪽 패널에서 생성된 5글자, 6글자 단어를 확인합니다.</p>
                        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border">
                                    <span className="text-sm">만들어진 6글자 단어</span>
                                    <Badge variant="default" className="text-xs">12</Badge>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border">
                                    <span className="text-sm">만들어진 5글자 단어</span>
                                    <Badge variant="default" className="text-xs">8</Badge>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 사용 예시 */}
                <div className="space-y-3 ml-6">
                    <h4 className="font-semibold">사용 예시</h4>
                    <div className="space-y-3">
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">입력 (일반 글자조각):</p>
                            <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto">
                                가가가가가가가나나나나난다다다다다다다다라라라라라
                            </pre>
                        </div>
                        <div className="flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-sm text-gray-500 dark:text-gray-400">조합하기 실행</div>
                                <div className="text-2xl">↓</div>
                            </div>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">결과:</p>
                            <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded border border-green-200 dark:border-green-800">
                                <div className="text-sm space-y-1">
                                    <div className="font-medium text-green-800 dark:text-green-200">6글자 단어:</div>
                                    <div>• 가가가가가가</div>
                                    <div className="font-medium text-green-800 dark:text-green-200 mt-2">5글자 단어:</div>
                                    <div>• 라라리라라</div>
                                </div>
                                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                                    총 2개 단어 생성됨
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* HTML 입력창 사용법 */}
            <div className="space-y-4">
                <h3 ref={HTMLHelp} className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm px-2 py-1 rounded-full font-medium">2</span>
                    HTML 입력창 사용법
                </h3>

                <div className="ml-6 space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        HTML 입력창은 글자조각을 직접 추출할 때 사용합니다.
                        브라우저의 개발자 도구를 통해 HTML 코드를 복사하여 사용할 수 있습니다.
                    </p>

                    <h4 ref={chromeHTML} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        구글 크롬(Chrome) 사용법
                    </h4>

                    <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <p className="text-yellow-800 dark:text-yellow-200 text-sm mb-2">
                            <strong>📖 상세 가이드:</strong>
                        </p>
                        <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                            사진이 많은 관계로 구글문서로 연결됩니다. →
                            <a
                                href='https://docs.google.com/document/d/1wlX4TaC4Y_b-Dnjjy5uXc0GwWpFy7GGE2EWwAAeLcSE/edit?tab=t.0#heading=h.djjvvf8p8lrr'
                                className='text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200'
                                target='_blank'
                                rel="noopener noreferrer"
                            >
                                구글문서로 이동하기
                            </a>
                        </p>
                    </div>

                </div>
            </div>

            {/* 팁 섹션 */}
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                    <strong>💡 유용한 팁:</strong>
                </p>
                <ul className="text-blue-700 dark:text-blue-300 text-sm mt-2 space-y-1 list-disc list-inside">
                    <li>각 탭별로 다른 등급의 글자조각을 관리할 수 있습니다.</li>
                    <li>HTML 입력은 텍스트를 대량으로 추출할 때 유용합니다.</li>
                </ul>
            </div>
        </div>
    );
};

export default function HelpModalB({ wantGo, viewTxt }: { wantGo?: 1 | 2 | 3; viewTxt?: boolean; }) {
    return (
        <HelpModal
            title="끄코 낱장 단어 조합기 사용설명서"
            triggerText={viewTxt ? "도움말" : ""}
        >
            <HelpModalA wantGo={wantGo} />
        </HelpModal>
    );
}