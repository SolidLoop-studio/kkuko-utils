import React from 'react';
import { Send, MessageCircle } from 'lucide-react';
import { useChat } from './hooks/useChat';
import { useChatLog } from './hooks/useChatLog';

/**
 * 게임 내 채팅창 컴포넌트
 * 메시지 목록을 표시하고 채팅 입력을 처리합니다.
 */
const KkutuChat = () => {
    const { chatInput, handleChatInputChange } = useChat();
    const { messages, chatRef, handleSendMessage, sendHint } = useChatLog();
    const { callGameInput, gameInputVisible } = useChat();

    return (
        <div className="w-full max-w-[1000px] -mt-8 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* 채팅 헤더 */}
            <div className="flex bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-300 dark:border-gray-700">
                <MessageCircle size={20} className="mr-2 text-gray-600 dark:text-gray-300" fill={"gray-100"} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">채팅</h3>
            </div>

            {/* 채팅 메시지 영역 */}
            <div
                ref={chatRef}
                className="h-32 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800"
                id="Chat"
            >
                {messages.map((message, index) => (
                    <div key={message.id}>
                        {index > 0 && (
                            <hr className="border-0 border-b border-dashed border-gray-400 my-1" />
                        )}
                        <div className={`chat-item w-full overflow-hidden p-1 my-1 ${message.isNotice ? 'bg-gray-300 dark:bg-gray-700' : ''
                            }`}>
                            <div className="flex items-start gap-2">
                                {/* 타임스탬프 */}
                                <div className="chat-stamp w-16 text-xs text-gray-500 dark:text-gray-400 text-right pt-1 flex-shrink-0">
                                    {message.timestamp}
                                </div>

                                {/* 사용자 이름 */}
                                <div className={`chat-head w-24 font-bold text-center cursor-pointer hover:bg-white dark:hover:bg-gray-700 px-2 py-1 rounded flex-shrink-0 ${message.isNotice ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'
                                    }`}>
                                    {message.username}
                                </div>

                                {/* 메시지 내용 */}
                                <div className="chat-body flex-1 min-h-4 py-1 text-gray-800 dark:text-gray-100">
                                    {message.message}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 입력 영역 */}
            <div className="flex border-t border-gray-300 dark:border-gray-700">
                <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            // If the game input is visible, forward Enter to the registered game handler
                            if (gameInputVisible) {
                                e.preventDefault();
                                const trimmed = chatInput.trim();
                                if (trimmed === '/ㅍ' || trimmed === '/v') {
                                    sendHint();
                                    return;
                                }
                                if (trimmed) {
                                    callGameInput(chatInput);
                                }
                                return;
                            }

                            // otherwise send as chat message
                            handleSendMessage();
                        }
                    }}
                    maxLength={200}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 px-4 py-2 border-0 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-none text-gray-800 dark:text-white"
                    id="TalkX"
                />
                <button
                    onClick={handleSendMessage}
                    className="w-16 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 flex items-center justify-center transition-colors"
                    id="ChatBtn"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
};

export default KkutuChat;