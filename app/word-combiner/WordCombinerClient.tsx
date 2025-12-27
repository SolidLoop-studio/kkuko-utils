"use client"
import React, { useState } from 'react';
import type { SixCharString, FiveCharString, ErrorMessage } from '@/types/type';
import CombinationManager from '../lib/CombinationsManger';
import ErrorModal from '../components/ErrModal';
import HelpModal from './WordCombinerHelpModal';
import Spinner from '../components/Spinner';

interface WordCombinerWithData {
    len5: string[];
    len6: string[];
}

export default function WordCombinerClient({ prop }: { prop: WordCombinerWithData }) {
    const [normalJOKAK, setNormalJOKAK] = useState<string>("");
    const [highJOKAK, setHighJOKAK] = useState<string>("");
    const [rareJOKAK, setRareJOKAK] = useState<string>("");
    const [inputHtml, setInputHtml] = useState<string>("");
    const [placeholderArray] = useState<[string, string, string]>(["일반 글자조각 입력", "고급 글자조각 입력", "희귀 글자조각 입력"]);
    const [len6Data, setLen6Date] = useState<SixCharString[]>([]);
    const [len5Data, setLen5Data] = useState<FiveCharString[]>([]);
    const [len6WordsData] = useState<SixCharString[]>(prop.len6);
    const [len5WordsData] = useState<FiveCharString[]>(prop.len5);
    const [loading, setLoading] = useState(false);
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const [activeTab, setActiveTab] = useState<'normal' | 'high' | 'rare' | 'html'>('normal');

    const handleHtmlSubmit = () => {
        try {
            const htmlString = inputHtml;
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlString, 'text/html');

            let normal = ""; // 일반
            let high = ""; // 고급
            let rare = ""; // 희귀

            const dressItems = doc.querySelectorAll('div.dress-item.expl-mother');

            dressItems.forEach(item => {
                const countTextElement = item.querySelector('div.jt-image.dress-item-image');
                const charNameElement = item.querySelector('div.dress-item-title');

                if (!countTextElement || !charNameElement) {
                    // 하나라도 null이면 해당 item 건너뛰기
                    return;
                }

                const countText = countTextElement.textContent?.trim() ?? '';
                const tCount = parseInt(countText.replace('x', ''), 10) || 0;
                const charName = charNameElement.textContent?.trim() ?? '';

                if (charName.includes("고급 글자 조각")) {
                    const chName = charName.replace("고급 글자 조각 - ", "");
                    high += chName.repeat(tCount);
                } else if (charName.includes("희귀 글자 조각")) {
                    const chName = charName.replace("희귀 글자 조각 - ", "");
                    rare += chName.repeat(tCount);
                } else if (charName.includes("글자 조각")) {
                    const chName = charName.replace("글자 조각 - ", "");
                    normal += chName.repeat(tCount);
                }
            });
            setInputHtml("");
            setNormalJOKAK(normal);
            setHighJOKAK(high);
            setRareJOKAK(rare);
            setActiveTab('normal');
        } catch (err: unknown) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: null
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: null
                });
            }
        }
    };

    const processCombN = () => {
        try {
            setLoading(true);
            setTimeout(() => {
                const manger6 = new CombinationManager(normalJOKAK.replace(/\s+/g, '').split('').sort().join(''), len6WordsData);
                setLen6Date(manger6.getBests());
                const manger5 = new CombinationManager(manger6.remainStr(), len5WordsData);
                setLen5Data(manger5.getBests());
                setLoading(false);
                setNormalJOKAK(manger5.remainStr());
            }, 1)
        } catch (err: unknown) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: null
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: null
                });
            }
        } finally {
            setLoading(false);
        }
    }

    const processCombH = () => {
        try {
            setLoading(true);
            setTimeout(() => {
                const manger6 = new CombinationManager(highJOKAK.replace(/\s+/g, '').split('').sort().join(''), len6WordsData);
                setLen6Date(manger6.getBests());
                const manger5 = new CombinationManager(manger6.remainStr(), len5WordsData);
                setLen5Data(manger5.getBests());
                setLoading(false);
                setHighJOKAK(manger5.remainStr());
            }, 1)
        } catch (err: unknown) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: null
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: null
                });
            }
        } finally {
            setLoading(false);
        }
    }

    const processCombR = () => {
        try {
            setLoading(true);
            setTimeout(() => {
                const manger6 = new CombinationManager(rareJOKAK.replace(/\s+/g, '').split('').sort().join(''), len6WordsData);
                setLen6Date(manger6.getBests());
                const manger5 = new CombinationManager(manger6.remainStr(), len5WordsData);
                setLen5Data(manger5.getBests());
                setLoading(false);
                setRareJOKAK(manger5.remainStr());
            }, 1)
        } catch (err: unknown) {
            if (err instanceof Error) {
                seterrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: null
                });
            } else {
                seterrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: null
                });
            }
        } finally {
            setLoading(false);
        }
    }

    const getProcessFunction = () => {
        switch(activeTab) {
            case 'normal': return processCombN;
            case 'high': return processCombH;
            case 'rare': return processCombR;
            case 'html': return handleHtmlSubmit;
            default: return processCombN;
        }
    };

    const getCurrentValue = () => {
        switch(activeTab) {
            case 'normal': return normalJOKAK;
            case 'high': return highJOKAK;
            case 'rare': return rareJOKAK;
            case 'html': return inputHtml;
            default: return "";
        }
    };

    const getCurrentSetter = () => {
        switch(activeTab) {
            case 'normal': return setNormalJOKAK;
            case 'high': return setHighJOKAK;
            case 'rare': return setRareJOKAK;
            case 'html': return setInputHtml;
            default: return setNormalJOKAK;
        }
    };

    const getCurrentPlaceholder = () => {
        if (activeTab === 'html') return "HTML 코드를 여기에 붙여넣으세요";
        const idx = activeTab === 'normal' ? 0 : activeTab === 'high' ? 1 : 2;
        return placeholderArray[idx];
    };

    const handleClick = () => {
        const fn = getProcessFunction();
        setLoading(true);
        setTimeout(() => {
          fn();
          setLoading(false);
        }, 0);
      };
      

    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100">
            {/* Header with help button */}
            <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">글자조각 조합기</h1>
                <HelpModal viewTxt />
            </header>

            {/* Main container */}
            <div className="flex flex-col lg:flex-row flex-grow p-4 gap-6 max-w-7xl mx-auto w-full">
                {/* Left panel - Input section */}
                <div className="w-full lg:w-1/2 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    {/* Tab navigation */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700">
                        {[
                            { key: 'normal', label: '일반 글자조각' },
                            { key: 'high', label: '고급 글자조각' },
                            { key: 'rare', label: '희귀 글자조각' },
                            { key: 'html', label: 'HTML 입력' }
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                className={`flex-1 py-3 text-sm font-medium ${
                                    activeTab === tab.key 
                                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                                onClick={() => setActiveTab(tab.key as 'normal' | 'high' | 'rare' | 'html')}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Input area */}
                    <div className="p-6 flex-grow">
                        <div className="flex flex-col h-full space-y-4">
                            <div className="relative flex-grow">
                                <textarea
                                    placeholder={getCurrentPlaceholder()}
                                    className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm 
                                              focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700
                                              transition duration-200 resize-none"
                                    value={getCurrentValue()}
                                    onChange={(e) => getCurrentSetter()(e.target.value)}
                                    disabled={loading}
                                />
                                
                                {activeTab === 'html' && (
                                    <div className="absolute top-2 right-2 text-blue-500 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200">
                                        <HelpModal wantGo={3} />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex justify-end">
                                <button
                                    className={`px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center space-x-2
                                              hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                                              transition duration-200 transform hover:scale-105
                                              ${loading ? "bg-gray-500 dark:bg-gray-600 cursor-not-allowed" : ""}`}
                                    onClick={handleClick}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                                    ) : (
                                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                                        </svg>
                                    )}
                                    {activeTab === 'html' ? '처리하기' : '조합하기'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Stats display */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400">일반</span>
                                <span className="text-lg font-semibold">{normalJOKAK.length}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400">고급</span>
                                <span className="text-lg font-semibold">{highJOKAK.length}</span>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                                <span className="text-xs text-gray-500 dark:text-gray-400">희귀</span>
                                <span className="text-lg font-semibold">{rareJOKAK.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right panel - Results section */}
                <div className="w-full lg:w-1/2 flex flex-col gap-6">
                    {[
                        { title: "만들어진 6글자 단어", data: len6Data, icon: "/icon-6char.svg" }, 
                        { title: "만들어진 5글자 단어", data: len5Data, icon: "/icon-5char.svg" }
                    ].map((section, idx) => (
                        <div className="flex flex-col flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" key={idx}>
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center">
                                <div className="w-8 h-8 mr-3 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">{idx === 0 ? '6' : '5'}</span>
                                </div>
                                <h3 className="flex-1 font-medium text-gray-700 dark:text-gray-300">{section.title}</h3>
                                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                                    {section.data.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto max-h-[calc(50vh-100px)]">
                                {section.data.length > 0 ? (
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {section.data.map((item, index) => (
                                            <div key={index} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                                <div className="flex-none w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-full mr-4">
                                                    <span className="text-gray-600 dark:text-gray-300 font-medium">{index + 1}</span>
                                                </div>
                                                <div className="flex-grow">
                                                    <p className="text-lg font-medium text-gray-900 dark:text-gray-100">{item}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                                        <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                                        </svg>
                                        <p className="text-gray-500 dark:text-gray-400">아직 결과가 없습니다. 글자조각을 입력하고 조합해보세요.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Loading overlay */}
            {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl flex items-center space-x-4">
                        <Spinner />
                        <p className="text-gray-700 dark:text-gray-300 font-medium">처리 중...</p>
                    </div>
                </div>
            )}

            {/* Error modal */}
            {errorModalView && <ErrorModal error={errorModalView} onClose={() => seterrorModalView(null)} />}
        </div>
    );
}