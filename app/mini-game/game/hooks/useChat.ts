import React, { createContext, useContext, useRef, useState } from "react";

export interface ChatMessage {
    id: number;
    username: string;
    message: string;
    timestamp: string;
    isNotice?: boolean;
}

type ChatContextType = {
    chatInput: string;
    setChatInput: (v: string) => void;
    handleChatInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    // Register / call the game's input handler without causing re-renders.
    registerGameHandleInput: (fn: ((s: string) => void) | null) => void;
    callGameInput: (s: string) => void;
    gameInputVisible: boolean;
    setGameInputVisible: (v: boolean) => void;
    // allow registering a global sendHint function so other UI (GameHead) can trigger it
    registerSendHint: (fn: (() => void) | null) => void;
    sendHint: () => void;
    // chat log shared state and helpers
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
    chatRef: React.RefObject<HTMLDivElement | null>;
    clearMessagesAndShowStartNotice: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

/**
 * 채팅 입력 상태를 관리하는 Provider 컴포넌트
 * 게임 내 채팅 입력값을 전역적으로 관리합니다.
 */
export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [chatInput, setChatInput] = useState("");
    const gameHandleRef = useRef<((s: string) => void) | null>(null);
    const sendHintRef = useRef<(() => void) | null>(null);
    const [gameInputVisible, setGameInputVisible] = useState<boolean>(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 1,
            username: '알림',
            message: '게임방에 입장하셨습니다.',
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            isNotice: true
        }
    ]);
    const chatRef = useRef<HTMLDivElement>(null);

    /**
     * 채팅 입력값 변경 핸들러
     */
    const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setChatInput(e.target.value);
    };

    const registerGameHandleInput = (fn: ((s: string) => void) | null) => {
        gameHandleRef.current = fn;
    };

    const callGameInput = (s: string) => {
        try {
            gameHandleRef.current?.(s);
        } catch (e) {
            console.error(e);
        }
    };

    const registerSendHint = (fn: (() => void) | null) => {
        sendHintRef.current = fn;
    };

    const sendHint = () => {
        try {
            sendHintRef.current?.();
        } catch (e) {
            console.error(e);
        }
    };

    const clearMessagesAndShowStartNotice = () => {
        const noticeMessage: ChatMessage = {
            id: Date.now(),
            username: '알림',
            message: '게임을 시작합니다!',
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            isNotice: true
        };
        setMessages([noticeMessage]);
        setChatInput('');
    };

    return React.createElement(
        ChatContext.Provider,
        { value: { chatInput, setChatInput, handleChatInputChange, registerGameHandleInput, callGameInput, gameInputVisible, setGameInputVisible, registerSendHint, sendHint, messages, setMessages, chatRef, clearMessagesAndShowStartNotice } },
        children
    );
};

/**
 * 채팅 컨텍스트를 사용하기 위한 커스텀 훅
 * ChatProvider 내부에서만 사용 가능합니다.
 */
export const useChat = () => {
    const ctx = useContext(ChatContext);
    if (!ctx) {
        throw new Error("useChat must be used within a ChatProvider");
    }
    return ctx;
};