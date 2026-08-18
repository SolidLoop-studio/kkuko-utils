'use client';

import React, { useState, useEffect } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle
} from '@/src/app/components/ui/card';
import { Label } from '@/src/app/components/ui/label';
import { Button } from '@/src/app/components/ui/button';
import { Checkbox } from '@/src/app/components/ui/checkbox';
import { Download, Filter, AlertCircle, Loader2, BarChart3, Database, LockKeyhole, Sprout, TrendingUp, CircleCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/src/app/components/ui/alert';
import { SCM } from '@/src/app/lib/supabaseClient';
import { useSelector } from 'react-redux';
import type { RootState } from '@/src/app/store/store';


type ChartItem = {
    type: string;
    count: number;
    color: string;
    darkColor: string;
};

// 단어 통계를 가져오는 함수
const fetchWordStats = async (params: {
    includeAdded: boolean;
    includeDeleted: boolean;
    includeAcknowledged: boolean;
    includeNotAcknowledged: boolean;
    onlyWordChain: boolean;
}) => {
    const {
        includeAdded,
        includeDeleted,
        includeAcknowledged,
        includeNotAcknowledged,
        onlyWordChain,
    } = params;

    try {
        // 어인정/노인정 단어 수 조회
        let acknowledgedCount = 0;
        let notAcknowledgedCount = 0;
        let wordChainCount = 0;
        let wordNotChainCount = 0;

        const {data:wordsData, error: wordsError} = await SCM.get().allWords({
            includeAddReq: includeAdded,
            includeDeleteReq: includeDeleted,
            includeInjung: includeAcknowledged,
            includeNoInjung: includeNotAcknowledged,
            onlyWordChain: onlyWordChain
        });

        if (wordsError) throw wordsError;

        const delR = wordsData.filter(word => word.status === 'delete');

        acknowledgedCount = wordsData.filter(word => !word.noin_canuse && word.status === "ok" && !delR.some(delWord => delWord.word === word.word)).length;
        notAcknowledgedCount = wordsData.filter(word => word.noin_canuse && word.status === "ok" && !delR.some(delWord => delWord.word === word.word)).length;
        wordChainCount = wordsData.filter(word => word.k_canuse && word.status === "ok" && !delR.some(delWord => delWord.word === word.word)).length;
        wordNotChainCount = wordsData.filter(word => !word.k_canuse && word.status === "ok" && !delR.some(delWord => delWord.word === word.word)).length;

        // 추가/삭제 요청 단어 수 조회
        const addedCount = wordsData.filter(word => word.status === 'add').length;
        const deletedCount = delR.length;

        // 전체 단어 수
        const totalCount = acknowledgedCount + notAcknowledgedCount + addedCount;

        // 차트 데이터 생성
        const chartData = [
            { type: '어인정', count: acknowledgedCount, color: 'bg-blue-500', darkColor: 'dark:bg-blue-400' },
            { type: '노인정', count: notAcknowledgedCount, color: 'bg-yellow-500', darkColor: 'dark:bg-yellow-400' },
            { type: '추가요청', count: addedCount, color: 'bg-green-500', darkColor: 'dark:bg-green-400' },
            { type: '삭제요청', count: deletedCount, color: 'bg-red-500', darkColor: 'dark:bg-red-400' },
            { type: '끝말잇기 가능', count: wordChainCount, color: 'bg-indigo-500', darkColor: 'dark:bg-indigo-400' },
            { type: '끝말잇기 불가', count: wordNotChainCount, color: 'bg-purple-500', darkColor: 'dark:bg-purple-400' },
        ].filter(item => (item.type === '추가요청' && includeAdded) ||
            (item.type === '삭제요청' && includeDeleted) ||
            (item.type === '어인정' && includeAcknowledged) ||
            (item.type === '노인정' && includeNotAcknowledged) ||
            (item.type === '끝말잇기 가능' || item.type === '끝말잇기 불가'));

        return {
            totalCount,
            acknowledgedCount: includeAcknowledged ? acknowledgedCount : 0,
            notAcknowledgedCount: includeNotAcknowledged ? notAcknowledgedCount : 0,
            addedCount: includeAdded ? addedCount : 0,
            deletedCount: includeDeleted ? deletedCount : 0,
            wordChainCount: wordChainCount,
            wordNotChainCount: wordNotChainCount,
            chartData
        };
    } catch (error) {
        console.error('통계 데이터 로딩 오류:', error);
        throw error;
    }
};

// 다운로드용 단어 데이터 가져오기
const fetchWordData = async (params: {
    includeAdded: boolean;
    includeDeleted: boolean;
    includeAcknowledged: boolean;
    includeNotAcknowledged: boolean;
    onlyWordChain: boolean;
}) => {
    const resultWords: string[] = [];

    try {
        const {
            includeAdded,
            includeDeleted,
            includeAcknowledged,
            includeNotAcknowledged,
            onlyWordChain,
        } = params;

        // words테이블에서 단어 가져오기
        const {data:wordsData, error: wordsError} = await SCM.get().allWords({
            includeAddReq: includeAdded,
            includeDeleteReq: includeDeleted,
            includeInjung: includeAcknowledged,
            includeNoInjung: includeNotAcknowledged,
            onlyWordChain: onlyWordChain
        });

        if (wordsError) throw wordsError;

        const delR = wordsData.filter(word => word.status === 'delete');

        wordsData
        .filter(word => word.status === 'ok' && !delR.some(delWord => delWord.word === word.word))
        .map(word => word.word)
        .forEach(word => resultWords.push(word));
        wordsData.filter(word => word.status === 'add').map(word => word.word).forEach(word=>resultWords.push(word))

        return [...new Set(resultWords)].sort((a, b) => a.localeCompare(b, 'ko'));
    } catch (error) {
        throw error;
    }
};

function KoreanWordStats() {
    // 필터 상태
    const [includeAdded, setIncludeAdded] = useState(false); // 추가 요청 단어 포함
    const [includeDeleted, setIncludeDeleted] = useState(false); // 삭제 요청 단어 포함
    const [includeAcknowledged, setIncludeAcknowledged] = useState(true); // 어인정 단어 허용
    const [includeNotAcknowledged, setIncludeNotAcknowledged] = useState(false); // 노인정 단어 허용
    const [onlyWordChain, setOnlyWordChain] = useState(false); // 끝말잇기 사용 가능한 단어만 포함

    // 통계 상태
    const [stats, setStats] = useState<{
        totalCount: number;
        acknowledgedCount: number;
        notAcknowledgedCount: number;
        addedCount: number;
        deletedCount: number;
        wordChainCount: number;
        wordNotChainCount: number;
        chartData: ChartItem[];
    }>({
        totalCount: 0,
        acknowledgedCount: 0,
        notAcknowledgedCount: 0,
        addedCount: 0,
        deletedCount: 0,
        wordChainCount: 0,
        wordNotChainCount: 0,
        chartData: [],
    });

    // UI 상태
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [downloadLoading, setDownloadLoading] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('all');

    // 체크 박스 업데이트 될떄 통계 리로딩 트리거
    useEffect(() => {
        fetchStats();
    }, [includeAdded, includeDeleted, includeAcknowledged, includeNotAcknowledged, onlyWordChain]);

    // 통계 데이터 조회 함수
    const fetchStats = async () => {
        // 현재 상태값으로 params 생성
        const params = {
            includeAdded,
            includeDeleted,
            includeAcknowledged,
            includeNotAcknowledged,
            onlyWordChain,
        };

        // 어인정/노인정 필터가 선택되었는지 확인 - 단어는 노인정/어인정 중 꼭 하나만 가지므로 한개도 선택안하면 단어가 없음
        if (!params.includeAcknowledged && !params.includeNotAcknowledged) {
            setError('어인정 단어 허용, 노인정 단어 허용 중 최소 하나는 선택해야 합니다.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const statsData = await fetchWordStats(params);
            setStats(statsData);
        } catch (err) {
            setError('데이터를 불러오는 중 오류가 발생했습니다.');
            console.error('통계 데이터 로딩 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    // 초기 데이터 로드
    useEffect(() => {
        fetchStats();
    }, []);

    // 단어 다운로드 함수
    const downloadWords = async () => {
        setDownloadLoading(true);

        try {
            const params = {
                includeAdded,
                includeDeleted,
                includeAcknowledged,
                includeNotAcknowledged,
                onlyWordChain,
            };

            const words = await fetchWordData(params);
            const content = words.join('\n');
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = '끄코_단어목록.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError('다운로드 중 오류가 발생했습니다.'+`${err}`);
            console.error('다운로드 오류:', err);
        } finally {
            setDownloadLoading(false);
        }
    };

    // 차트 렌더링 함수
    const renderChart = () => {
        const { chartData } = stats;
        const maxValue = Math.max(...chartData.map(item => item.count), 1);

        return (
            <div className="mt-6 space-y-3">
                <h3 className="font-medium text-gray-700 dark:text-gray-200 flex items-center">
                    <BarChart3 className="mr-2 h-5 w-5 text-blue-500 dark:text-blue-400" />
                    단어 분포
                </h3>

                <div className="space-y-2">
                    {chartData.map((item, index) => (
                        <div key={index} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{item.type}</span>
                                <span className="text-gray-500 dark:text-gray-400">{item.count.toLocaleString()}개</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                                <div
                                    className={`${item.color} ${item.darkColor} h-2.5 rounded-full transition-all duration-500`}
                                    style={{ width: `${(item.count / maxValue) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // 통계 카드 렌더링 함수
    const renderStatCards = () => {
        // 모든 카테고리를 항상 표시하도록 수정
        const categories = [
            { id: 'all', name: '전체', count: stats.totalCount, icon: <Database className="h-5 w-5" />, color: 'bg-blue-500', darkColor: 'dark:bg-blue-600' },
            { id: 'acknowledged', name: '어인정', count: stats.acknowledgedCount, icon: <Database className="h-5 w-5" />, color: 'bg-green-500', darkColor: 'dark:bg-green-600' },
            { id: 'notAcknowledged', name: '노인정', count: stats.notAcknowledgedCount, icon: <Database className="h-5 w-5" />, color: 'bg-yellow-500', darkColor: 'dark:bg-yellow-600' },
            { id: 'added', name: '추가요청', count: stats.addedCount, icon: <Database className="h-5 w-5" />, color: 'bg-purple-500', darkColor: 'dark:bg-purple-600' },
            { id: 'deleted', name: '삭제요청', count: stats.deletedCount, icon: <Database className="h-5 w-5" />, color: 'bg-red-500', darkColor: 'dark:bg-red-600' },
            { id: 'wordChain', name: '끝말잇기 가능', count: stats.wordChainCount, icon: <Database className="h-5 w-5" />, color: 'bg-indigo-500', darkColor: 'dark:bg-indigo-600' },
            { id: 'wordNotChain', name: '끝말잇기 불가', count: stats.wordNotChainCount, icon: <Database className="h-5 w-5" />, color: 'bg-orange-500', darkColor: 'dark:bg-orange-600' }
        ];

        // 현재 필터에 따라 적절한 카테고리만 표시
        const filteredCategories = categories.filter(cat => {
            if (cat.id === 'all') return true;
            if (cat.id === 'acknowledged' && !includeAcknowledged) return false;
            if (cat.id === 'notAcknowledged' && !includeNotAcknowledged) return false;
            if (cat.id === 'added' && !includeAdded) return false;
            if (cat.id === 'deleted' && !includeDeleted) return false;
            if (cat.id === 'wordNotChain' && onlyWordChain) return false
            return true;
        });

        return (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                {filteredCategories.map(category => (
                    <Card
                        key={category.id}
                        className={`cursor-pointer transition-all duration-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 ${selectedCategory === category.id ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg' : 'hover:shadow-md'
                            }`}
                        onClick={() => setSelectedCategory(category.id)}
                    >
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className={`${category.color} ${category.darkColor} p-2 rounded-full text-white mb-2`}>
                                {category.icon}
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{category.count.toLocaleString()}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{category.name}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="container mx-auto py-8 max-w-4xl">
            <Card className="shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardHeader className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 text-white">
                    <CardTitle className="text-2xl font-bold">한국어 오픈 DB 단어 통계</CardTitle>
                    <CardDescription className="text-blue-100 dark:text-blue-50">
                        필터링 조건에 맞는 단어 수를 확인하고 필요한 단어를 다운로드하세요
                    </CardDescription>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                    {/* 필터 영역 */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <div className="flex items-center mb-3">
                            <Filter className="mr-2 h-5 w-5 text-gray-600 dark:text-gray-300" />
                            <h3 className="font-medium text-gray-800 dark:text-gray-200">필터 설정</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeAdded"
                                        checked={includeAdded}
                                        onCheckedChange={(checked) =>
                                            setIncludeAdded(checked === true)
                                        }
                                    />
                                    <Label htmlFor="includeAdded" className="text-gray-700 dark:text-gray-200">추가요청 단어 포함</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeDeleted"
                                        checked={includeDeleted}
                                        onCheckedChange={(checked) =>
                                            setIncludeDeleted(checked === true)
                                        }
                                    />
                                    <Label htmlFor="includeDeleted" className="text-gray-700 dark:text-gray-200">삭제요청 단어 제거</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="onlyWordChain"
                                        checked={onlyWordChain}
                                        onCheckedChange={(checked) =>
                                            setOnlyWordChain(checked === true)
                                        }
                                    />
                                    <Label htmlFor="onlyWordChain" className="text-gray-700 dark:text-gray-200">끝말잇기 사용가능 단어만</Label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeAcknowledged"
                                        checked={includeAcknowledged}
                                        onCheckedChange={(checked) =>
                                            setIncludeAcknowledged(checked === true)
                                        }
                                    />
                                    <Label htmlFor="includeAcknowledged" className="text-gray-700 dark:text-gray-200">어인정 단어 허용</Label>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeNotAcknowledged"
                                        checked={includeNotAcknowledged}
                                        onCheckedChange={(checked) =>
                                            setIncludeNotAcknowledged(checked === true)
                                        }
                                    />
                                    <Label htmlFor="includeNotAcknowledged" className="text-gray-700 dark:text-gray-200">노인정 단어 허용</Label>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                onClick={() => fetchStats()}
                                disabled={loading}
                                className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 통계 업데이트 중...
                                    </>
                                ) : (
                                    '필터 적용 및 통계 업데이트'
                                )}
                            </Button>
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            <AlertTitle className="text-red-800 dark:text-red-200">오류</AlertTitle>
                            <AlertDescription className="text-red-700 dark:text-red-300">{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* 통계 표시 영역 */}
                    {loading ? (
                        <div className="text-center py-16">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500 dark:text-blue-400" />
                            <p className="text-gray-500 dark:text-gray-400">통계 데이터를 불러오는 중...</p>
                        </div>
                    ) : (
                        <>
                            {/* 통계 카드 */}
                            {renderStatCards()}

                            {/* 차트 표시 */}
                            {stats.chartData.length > 0 && renderChart()}

                            {/* 선택된 카테고리에 대한 추가 정보 */}
                            {selectedCategory !== 'all' && (
                                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-2">
                                        {selectedCategory === 'acknowledged' && '어인정 단어란?'}
                                        {selectedCategory === 'notAcknowledged' && '노인정 단어란?'}
                                        {selectedCategory === 'added' && '추가요청 단어란?'}
                                        {selectedCategory === 'deleted' && '삭제요청 단어란?'}
                                        {selectedCategory === 'wordChain' && '끝말잇기 사용가능 단어란?'}
                                        {selectedCategory === 'wordNotChain' && '끝말잇기 사용불가 단어란?'}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                        {selectedCategory === 'acknowledged' && '끄코 특수규칙인 "어인정"을 켜야지 사용할 수 있는 단어입니다. 단어부에 의해 삭제/추가가 일어납니다.'}
                                        {selectedCategory === 'notAcknowledged' && '끄코에서 "어인정"여부에 상관없이 사용 가능한 단어입니다. 단어 추가/삭제가 잘 일어 나지 않습니다.'}
                                        {selectedCategory === 'added' && '사용자들이 DB에 추가를 요청한 단어들입니다. 검토 후 DB에 추가될 수 있습니다.'}
                                        {selectedCategory === 'deleted' && '사용자들이 DB에서 삭제를 요청한 단어들입니다. 검토 후 DB에서 제거될 수 있습니다.'}
                                        {selectedCategory === 'wordChain' && '끄코의 한끝/한앞/쿵따/한단대/자퀴에서 사용 가능한 단어들입니다.'}
                                        {selectedCategory === 'wordNotChain' && '끄코의 한끝/한앞/쿵따에서 사용할 수 없는 단어들입니다. 이 단어들은 끝말잇기 품사가 끄코에서 사용하기 부적절 하기에 제외되었습니다.'}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>

                <CardFooter className="bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 flex justify-between">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        필터링된 단어: {stats.totalCount.toLocaleString()}개
                    </div>
                    <Button
                        onClick={downloadWords}
                        variant="outline"
                        disabled={downloadLoading || stats.totalCount === 0}
                        className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
                    >
                        {downloadLoading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 처리 중...
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" /> 텍스트 파일로 다운로드
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

function WordsDownloadUnavailable({ role }: { role: RootState['user']['role'] }) {
    const currentStatus = role === 'guest' ? '비로그인' : '새싹(r1)';

    return (
        <div className="min-h-[70vh] bg-gradient-to-b from-gray-50 to-gray-100 px-4 py-12 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto max-w-3xl">
                <Card className="overflow-hidden border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <CardHeader className="items-center bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-10 text-center text-white dark:from-amber-600 dark:to-orange-600">
                        <div className="mb-3 rounded-full bg-white/20 p-4">
                            <LockKeyhole className="h-9 w-9" aria-hidden="true" />
                        </div>
                        <CardTitle>
                            <h1 className="text-2xl font-bold sm:text-3xl">오픈 DB 다운로드를 현재 사용할 수 없습니다</h1>
                        </CardTitle>
                        <CardDescription className="text-base text-amber-50">
                            일반 등급 이상인 회원만 이용할 수 있습니다.<br/>
                            불편을 드려 죄송합니다. 최대한 빠르게 이용 가능하도록 하겠습니다.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 p-6 sm:p-8">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
                            <p className="text-sm text-gray-500 dark:text-gray-400">현재 상태</p>
                            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{currentStatus}</p>
                        </div>

                        <section aria-labelledby="eligible-roles-title">
                            <div className="mb-3 flex items-center gap-2">
                                <CircleCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                                <h2 id="eligible-roles-title" className="font-semibold text-gray-900 dark:text-gray-100">이용 가능 등급</h2>
                            </div>
                            <p className="rounded-lg bg-blue-50 px-4 py-3 font-medium text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                                일반 · 활동가 · 베테랑 · 관리자
                            </p>
                        </section>

                        <section aria-labelledby="promotion-requirements-title">
                            <div className="mb-3 flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                                <h2 id="promotion-requirements-title" className="font-semibold text-gray-900 dark:text-gray-100">등급 승급 기준</h2>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                                    <div className="flex items-center gap-2 font-semibold text-green-900 dark:text-green-200">
                                        <Sprout className="h-5 w-5" aria-hidden="true" />
                                        <span>새싹 → 일반</span>
                                    </div>
                                    <p className="mt-2 text-sm text-green-800 dark:text-green-300">누적 기여도 500점</p>
                                </div>
                                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                                    <p className="font-semibold text-purple-900 dark:text-purple-200">일반 → 활동가</p>
                                    <p className="mt-2 text-sm text-purple-800 dark:text-purple-300">누적 기여도 3,500점</p>
                                </div>
                            </div>
                        </section>

                        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                            등급은 프로필에 표시되는 누적 기여도를 기준으로 합니다.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function WordsDownloadHome() {
    const role = useSelector((state: RootState) => state.user.role);

    if (role === 'guest' || role === 'r1') {
        return <WordsDownloadUnavailable role={role} />;
    }

    return <KoreanWordStats />;
}
