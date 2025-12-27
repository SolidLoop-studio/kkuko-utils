import { useEffect } from 'react';
import { useChat, ChatMessage } from './useChat';
import { useGameState } from './useGameState';
import gameManager from '../lib/GameManager';

/**
 * 채팅 메시지 목록 및 전송 로직을 관리하는 커스텀 훅
 */
export const useChatLog = () => {
    const { messages, setMessages, chatInput, setChatInput, callGameInput, registerSendHint, chatRef } = useChat();
    const { requestStart, isPlaying } = useGameState();

    const handleSendMessage = () => {
        if (chatInput.trim()) {
            const trimmedInput = chatInput.trim();

            // 게임 시작 명령어 체크
            if (trimmedInput === '/시작' || trimmedInput === '/ㄱ' || trimmedInput === '/r') {
                const noticeMessage: ChatMessage = {
                    id: Date.now(),
                    username: '알림',
                    message: '게임을 시작합니다!',
                    timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    isNotice: true
                };
                setMessages((prev) => [...prev, noticeMessage]);
                setChatInput('');
                // If game UI is already active, forward the start to the mounted game handler
                // so it can restart if the current game has ended. Otherwise request a new
                // game UI to be shown.
                if (!isPlaying) {
                    requestStart();
                } else {
                    try { callGameInput('/시작'); } catch (e) { console.error(e); }
                }
                return;
            }

            // 게임 종료 명령어 (채팅에서 바로 종료 요청)
            if (trimmedInput === '/gg' || trimmedInput === '/ㅈㅈ') {
                setChatInput('');
                try { callGameInput(trimmedInput); } catch (e) { console.error(e); }
                setChatInput('');
                const noticeMessage: ChatMessage = {
                    id: Date.now(),
                    username: '알림',
                    message: '게임을 종료합니다.',
                    timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    isNotice: true
                };
                setMessages(prev => [...prev, noticeMessage]);
                return;
            }

            // 힌트 명령어 (/ㅍ 또는 /v)
            if (trimmedInput === '/ㅍ' || trimmedInput === '/v') {
                const hint = gameManager.getHintWord();
                if (hint === null) { setChatInput(''); return; }
                const hintMsg: ChatMessage = {
                    id: Date.now(),
                    username: '힌트',
                    message: hint ? `힌트: ${hint}` : '힌트가 없습니다.',
                    timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                    isNotice: false
                };
                setMessages(prev => [...prev, hintMsg]);
                setChatInput('');
                return;
            }

            const newMessage: ChatMessage = {
                id: Date.now(),
                username: '나',
                message: chatInput,
                timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            };

            setMessages(prev => [...prev, newMessage]);
            setChatInput('');
        }
    };

    // register our hint sender so other UI (GameHead) can trigger it
    useEffect(() => {
        registerSendHint(() => {
            const hint = gameManager.getHintWord();
            if (hint === null) { setChatInput(''); return; }
            const hintMsg: ChatMessage = {
                id: Date.now(),
                username: '힌트',
                message: hint ? `힌트: ${hint}` : '힌트가 없습니다.',
                timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                isNotice: false
            };
            setMessages(prev => [...prev, hintMsg]);
            setChatInput('');
        });
        return () => registerSendHint(null);
    }, [registerSendHint, setMessages, setChatInput]);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    // 메시지가 추가될 때마다 스크롤을 아래로 이동
    useEffect(() => {
        if (chatRef?.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages, chatRef]);

    return {
        messages,
        chatRef,
        handleSendMessage,
        handleKeyPress,
        sendHint: () => {
            const hint = gameManager.getHintWord();
            if (hint === null) { setChatInput(''); return; }
            const hintMsg: ChatMessage = {
                id: Date.now(),
                username: '힌트',
                message: hint ? `힌트: ${hint}` : '힌트가 없습니다.',
                timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                isNotice: false
            };
            setMessages(prev => [...prev, hintMsg]);
            setChatInput('');
        }
    };
};