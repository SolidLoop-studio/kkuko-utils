import React, { useState } from 'react';
import { HelpCircle, Settings, Book, LogOut, Play } from 'lucide-react';
import { useGameState } from '../hooks/useGameState';
import HelpModal from './HelpModal';
import SettingsModal from './SettingsModal';
import DictionaryModal from './DictionaryModal';
import ConfirmModal from './ConfirmModal';

/**
 * 게임 상단 메뉴 컴포넌트
 * 도움말, 설정, 사전, 시작, 나가기 버튼을 포함합니다.
 */
const KkutuMenu = () => {
    const { isPlaying, requestStart, exitGame, startBlocked, startBlockedMessage, dismissStartBlocked } = useGameState();

    const [helpOpen, setHelpOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [dictOpen, setDictOpen] = useState(false);

    // 버튼 클릭 핸들러
    const handleButtonClick = (buttonId: string) => {
        if (buttonId === 'start') {
            requestStart();
        } else if (buttonId === 'exit') {
            exitGame();
        } else if (buttonId === 'help') {
            setHelpOpen(true);
        } else if (buttonId === 'settings') {
            setSettingsOpen(true);
        } else if (buttonId === 'dict') {
            setDictOpen(true);
        }
        // 추후 기능 구현 예정 (settings, dict)
    };

    const buttonBaseClasses = "border-none rounded-t-lg h-8 transition-all duration-200 hover:scale-115 hover:shadow-lg shadow-md px-6 mt-5 origin-bottom text-gray-800 border-gray-800";

    return (
        <div className="w-[1010px] h-[40px] flex items-end">
            {/* 도움말 버튼 */}
            <button
                id="HelpBtn"
                className={`${buttonBaseClasses} bg-gray-400 hover:bg-gray-500 flex items-center justify-center gap-1 text-sm font-medium`}
                onClick={() => handleButtonClick('help')}
                aria-label="도움말"
            >
                <HelpCircle size={16} />
                <span className='text-gray-900'>도움말</span>
            </button>

            {/* 설정 버튼 */}
            <button
                id="SettingBtn"
                className={`${buttonBaseClasses} bg-gray-500 hover:bg-gray-600 flex items-center justify-center gap-1 text-sm font-medium`}
                onClick={() => handleButtonClick('settings')}
                aria-label="설정"
            >
                <Settings size={16} color='white' />
                <span className='text-white'>설정</span>
            </button>

            {/* 사전 버튼 */}
            <button
                id="DictionaryBtn"
                className={`${buttonBaseClasses} bg-green-400 hover:bg-green-500 flex items-center justify-center gap-1 text-sm font-medium`}
                onClick={() => handleButtonClick('dict')}
            >
                <Book size={14} />
                <span>사전</span>
            </button>

            {/* 시작 버튼 (게임 시작 전에만 표시) */}
            {!isPlaying && (
                <button
                    id="StartBtn"
                    className={`${buttonBaseClasses} flex items-center justify-center gap-1 text-sm font-medium`}
                    style={{ backgroundColor: '#FFB576' }}
                    onClick={() => handleButtonClick('start')}
                >
                    <Play size={14} />
                    <span>시작</span>
                </button>
            )}

            {/* 나가기 버튼 (게임 시작 후에만 표시) */}
            {isPlaying && (
                <button
                    id="ExitBtn"
                    className={`${buttonBaseClasses} bg-red-300 hover:bg-red-400 flex items-center justify-center gap-1 text-sm font-medium`}
                    onClick={() => handleButtonClick('exit')}
                >
                    <LogOut size={14} />
                    <span>나가기</span>
                </button>
            )}
                

            {helpOpen && (
                <HelpModal onClose={() => setHelpOpen(false)} />
            )}

            {settingsOpen && (
                <SettingsModal onClose={() => setSettingsOpen(false)} />
            )}

            {dictOpen && (
                <DictionaryModal onClose={() => setDictOpen(false)} />
            )}

            {startBlocked && (
                <ConfirmModal
                    message={startBlockedMessage ?? '게임을 시작할 수 없습니다.'}
                    onConfirm={() => dismissStartBlocked()}
                    onCancel={() => dismissStartBlocked()}
                />
            )}
        </div>
    );
};

export default KkutuMenu;