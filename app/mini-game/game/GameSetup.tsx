"use client";
import React, { useState, useEffect } from 'react';
import { loadWordsFromFile, hasWords, getAllWords, clearAllWords } from './lib/wordDB';
import WordManagerModal from './components/WordManagerModal';
import ConfirmModal from './components/ConfirmModal';
import StartCharModal from './components/StartCharModal';
import gameManager from './lib/GameManager';
import { soundManager } from './lib/SoundManager';

/**
 * 게임 시작 전 준비 화면 컴포넌트
 * 단어 데이터베이스 업로드 및 설정을 담당합니다.
 */
const GameSetup = () => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [message, setMessage] = useState<string>('');
    const [wordCount, setWordCount] = useState<number>(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [isStartCharModalOpen, setIsStartCharModalOpen] = useState(false);
    const [startCharInput, setStartCharInput] = useState<string>('');
    const [localSetting, setLocalSetting] = useState<{
        roundTimeSeconds: number;
        notAgainSameChar: boolean;
        hintMode: 'special' | 'auto';
        lang: 'ko' | 'en';
        mode: 'normal' | 'mission';
        startChars?: string;
    } | null>(null);

    // 컴포넌트 마운트 시 저장된 단어와 설정을 불러옴
    useEffect(() => {
        checkExistingWords();
        loadLocalSetting();
        soundManager.stopAllSounds();
    }, []);

    const loadLocalSetting = () => {
        try {
            const raw = localStorage.getItem('kkutu_game_setting');
            if (raw) {
                const parsed = JSON.parse(raw);
                const merged = {
                    roundTimeSeconds: parsed.roundTimeSeconds ?? Math.round(gameManager.getSetting().roundTime / 1000),
                    notAgainSameChar: parsed.notAgainSameChar ?? gameManager.getSetting().notAgainSameChar,
                    lang: parsed.lang ?? gameManager.getSetting().lang,
                    mode: parsed.mode ?? gameManager.getSetting().mode,
                    hintMode: parsed.hintMode ?? gameManager.getSetting().hintMode,
                    startChars: parsed.startChars ?? Array.from(gameManager.getSetting().wantStartChar).join('')
                };
                setLocalSetting(merged);
                setStartCharInput(merged.startChars);
                gameManager.updateSetting({
                    roundTime: merged.roundTimeSeconds * 1000,
                    notAgainSameChar: merged.notAgainSameChar,
                    lang: merged.lang,
                    mode: merged.mode,
                    hintMode: merged.hintMode,
                    wantStartChar: new Set((merged.startChars || '').split(''))
                });
            } else {
                const cur = gameManager.getSetting();
                const startCharsStr = Array.from(cur.wantStartChar).join('');
                setLocalSetting({ roundTimeSeconds: Math.round(cur.roundTime / 1000), notAgainSameChar: cur.notAgainSameChar, lang: cur.lang, mode: cur.mode, hintMode: cur.hintMode, startChars: startCharsStr });
                setStartCharInput(startCharsStr);
            }
        } catch (e) {
            const cur = gameManager.getSetting();
            const startCharsStr = Array.from(cur.wantStartChar).join('');
            setLocalSetting({ roundTimeSeconds: Math.round(cur.roundTime / 1000), notAgainSameChar: cur.notAgainSameChar, lang: cur.lang, mode: cur.mode, hintMode: cur.hintMode, startChars: startCharsStr });
            setStartCharInput(startCharsStr);
        }
    };
    const handleSettingChange = async (partial: Partial<{ roundTimeSeconds: number; notAgainSameChar: boolean; lang: 'ko' | 'en'; mode: 'normal' | 'mission'; hintMode: 'special' | 'auto' }>) => {
        const cur = gameManager.getSetting();
        const merged = {
            roundTimeSeconds: partial.roundTimeSeconds ?? localSetting?.roundTimeSeconds ?? Math.round(cur.roundTime / 1000),
            notAgainSameChar: partial.notAgainSameChar ?? localSetting?.notAgainSameChar ?? cur.notAgainSameChar,
            lang: partial.lang ?? localSetting?.lang ?? cur.lang,
            mode: partial.mode ?? localSetting?.mode ?? cur.mode,
            hintMode: partial.hintMode ?? localSetting?.hintMode ?? cur.hintMode,
            startChars: localSetting?.startChars ?? Array.from(cur.wantStartChar).join('')
        };
        setLocalSetting(merged);
        gameManager.updateSetting({ roundTime: merged.roundTimeSeconds * 1000, notAgainSameChar: merged.notAgainSameChar, lang: merged.lang, mode: merged.mode, hintMode: merged.hintMode });
        try {
            localStorage.setItem('kkutu_game_setting', JSON.stringify(merged));
        } catch (e) {
            // ignore storage errors
        }

        // If words exist, reload DB so maps reflect mode changes
        try {
            const exists = await hasWords();
            if (exists) {
                const words = await getAllWords();
                gameManager.loadWordDB(words.map(({ word, theme }) => ({ word, theme: theme.split(',') })), gameManager.getSetting());
                setWordCount(words.length);
            }
        } catch (e) {
            // ignore
        }
    };

    const openStartCharModal = () => {
        setStartCharInput(localSetting?.startChars ?? Array.from(gameManager.getSetting().wantStartChar).join(''));
        setIsStartCharModalOpen(true);
    };

    const saveStartChars = async () => {
        const cleaned = (startCharInput || '').replace(/\s+/g, '');
        const chars = cleaned.split('').filter(c => c !== '');
        const merged = { ...localSetting, startChars: cleaned };
        setLocalSetting(merged as any);
        gameManager.updateSetting({ wantStartChar: new Set(chars) });
        try {
            localStorage.setItem('kkutu_game_setting', JSON.stringify({ ...merged }));
        } catch (e) { }

        try {
            const exists = await hasWords();
            if (exists) {
                const words = await getAllWords();
                gameManager.loadWordDB(words.map(({ word, theme }) => ({ word, theme: theme.split(',') })), gameManager.getSetting());
                setWordCount(words.length);
            }
        } catch (e) { }

        setIsStartCharModalOpen(false);
    };

    const checkExistingWords = async () => {
        const exists = await hasWords();
        if (exists) {
            const words = await getAllWords();
            gameManager.loadWordDB(words.map(({ word, theme }) => ({ word, theme: theme.split(',') })), gameManager.getSetting());
            setWordCount(words.length);
            setMessage(`저장된 단어가 ${words.length}개 있습니다.`);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 1024 * 1024) {
                setMessage('파일 크기는 1MB를 초과할 수 없습니다.');
                setFile(null);
                return;
            }
            if (!selectedFile.name.endsWith('.txt')) {
                setMessage('txt 파일만 업로드 가능합니다.');
                setFile(null);
                return;
            }
            setFile(selectedFile);
            setMessage('');
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('파일을 선택해주세요.');
            return;
        }

        setIsUploading(true);
        setMessage('단어를 불러오는 중...');

        try {
            const count = await loadWordsFromFile(file);
            // 불러온 후 DB에서 전체를 읽어 gameManager에 로드
            const words = await getAllWords();
            gameManager.loadWordDB(words.map(({ word, theme }) => ({ word, theme: theme.split(',') })), gameManager.getSetting());
            setWordCount(words.length);
            setMessage(`${count}개의 단어를 성공적으로 불러왔습니다!`);
            setFile(null);

            // 파일 입력 초기화
            const fileInput = document.getElementById('word-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            setMessage(`오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleClearWords = async () => {
        setConfirmOpen(true);
    };

    const performClearWords = async () => {
        setConfirmOpen(false);
        try {
            await clearAllWords();
            gameManager.clearDB();
            setWordCount(0);
            setMessage('모든 단어가 삭제되었습니다.');
        } catch (e) {
            // ignore
        }
    };

    return (
        <>
            <div className="game-setup-container bg-white h-[410px] p-2 shadow-lg w-[1000px]">

                {/* 단어 로드 및 게임 설정을 가로로 배치 */}
                <div className="mb-4 flex gap-6 flex-col md:flex-row">
                    {/* 단어 데이터베이스 섹션 (왼쪽) */}
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">단어 데이터베이스 설정</h2>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-4">
                            <div className="mb-4">
                                <label htmlFor="word-file-input" className="block text-sm font-medium text-gray-700 mb-2">단어 파일 업로드 (txt, 최대 1MB)</label>
                                <input
                                    id="word-file-input"
                                    type="file"
                                    accept=".txt"
                                    onChange={handleFileChange}
                                    disabled={isUploading}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                                />
                            </div>

                            {file && (<div className="text-sm text-gray-600 mb-2">선택된 파일: {file.name} ({(file.size / 1024).toFixed(2)} KB)</div>)}

                            <button onClick={handleUpload} disabled={!file || isUploading} className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">{isUploading ? '업로드 중...' : '단어 불러오기'}</button>
                        </div>

                        {message && (<div className={`p-3 rounded-lg mb-4 ${message.includes('오류') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{message}</div>)}

                        <div className="flex gap-3">
                            <button onClick={() => setIsModalOpen(true)} className="bg-purple-500 text-white px-6 py-2 rounded-lg hover:bg-purple-600 transition-colors">단어 목록 조회 ({wordCount}개)</button>
                            {wordCount > 0 && <button onClick={handleClearWords} className="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition-colors">모든 단어 삭제</button>}
                        </div>
                    </div>

                    {/* 게임 설정 (오른쪽) */}
                    <div className="w-[320px] p-4 rounded-lg bg-gray-50 max-h-[320px] overflow-auto">
                        <h2 className="text-xl font-semibold mb-4 text-gray-700">게임 설정</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-700 mb-2">라운드 시간</label>
                                <select value={localSetting?.roundTimeSeconds ?? 60} onChange={(e) => handleSettingChange({ roundTimeSeconds: parseInt(e.target.value, 10) })} className="w-full px-3 py-2 border rounded-lg">
                                    <option value={0}>무제한</option>
                                    <option value={10}>10초</option>
                                    <option value={30}>30초</option>
                                    <option value={60}>60초</option>
                                    <option value={90}>90초</option>
                                    <option value={120}>120초</option>
                                    <option value={150}>150초</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-700 mb-2">언어</label>
                                <div className="flex gap-3">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="lang"
                                            value="ko"
                                            checked={(localSetting?.lang ?? 'ko') === 'ko'}
                                            onChange={() => handleSettingChange({ lang: 'ko' })}
                                        />
                                        <span className="text-sm text-gray-700">한국어</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="lang"
                                            value="en"
                                            checked={(localSetting?.lang ?? 'ko') === 'en'}
                                            onChange={() => handleSettingChange({ lang: 'en' })}
                                        />
                                        <span className="text-sm text-gray-700">English</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-700 mb-2">모드</label>
                                <div className="flex gap-3 mb-2">
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="normal"
                                            checked={(localSetting?.mode ?? 'normal') === 'normal'}
                                            onChange={() => handleSettingChange({ mode: 'normal' })}
                                        />
                                        <span className="text-sm text-gray-700">일반</span>
                                    </label>
                                    <label className="inline-flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="mode"
                                            value="mission"
                                            checked={(localSetting?.mode ?? 'normal') === 'mission'}
                                            onChange={() => handleSettingChange({ mode: 'mission' })}
                                        />
                                        <span className="text-sm text-gray-700">미션</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">힌트 모드</label>
                                    <div className="flex gap-3">
                                        <label className="inline-flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="hintMode"
                                                value="special"
                                                checked={(localSetting?.hintMode ?? 'special') === 'special'}
                                                onChange={() => handleSettingChange({ hintMode: 'special' })}
                                            />
                                            <span className="text-sm text-gray-700">특수 힌트</span>
                                        </label>
                                        <label className="inline-flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="hintMode"
                                                value="auto"
                                                checked={(localSetting?.hintMode ?? 'special') === 'auto'}
                                                onChange={() => handleSettingChange({ hintMode: 'auto' })}
                                            />
                                            <span className="text-sm text-gray-700">랜덤 힌트</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="inline-flex items-center gap-2">
                                    <input type="checkbox" checked={localSetting?.notAgainSameChar ?? false} onChange={(e) => handleSettingChange({ notAgainSameChar: e.target.checked })} />
                                    <span className="text-sm text-gray-700">이전에 나온글자 미표시</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 mb-2">제시어 설정</label>
                                <div className="flex items-center gap-3">
                                    <button onClick={openStartCharModal} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors">제시어 설정</button>
                                    <span className="text-sm text-gray-700">선택됨: {(localSetting?.startChars ?? Array.from(gameManager.getSetting().wantStartChar).join('')).length}개</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* 단어 관리 모달 */}
            {isModalOpen && (
                <WordManagerModal
                    onClose={() => {
                        setIsModalOpen(false);
                        checkExistingWords(); // 모달 닫을 때 단어 수 업데이트
                    }}
                />
            )}

            {confirmOpen && (
                <ConfirmModal
                    message={"모든 단어를 삭제하시겠습니까?"}
                    onConfirm={performClearWords}
                    onCancel={() => setConfirmOpen(false)}
                />
            )}

            <StartCharModal value={startCharInput} open={isStartCharModalOpen} onClose={() => setIsStartCharModalOpen(false)} onChange={setStartCharInput} onSave={saveStartChars} />
        </>
    );
};

export default GameSetup;