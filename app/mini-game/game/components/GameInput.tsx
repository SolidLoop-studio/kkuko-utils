import React from 'react';

interface GameInputProps {
    placeholder?: string;
    readonly?: boolean;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    className?: string;
    inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * 게임 입력창 컴포넌트
 * 사용자가 단어를 입력하는 필드입니다.
 */
const GameInput = ({
    placeholder = "Your turn - Input chat",
    readonly = false,
    value,
    onChange,
    onKeyDown,
    className = "",
    inputRef
}: GameInputProps) => {
    return (
        <div className={`
        relative 
        mt-2
        w-[460px]
        p-[5px] 
        rounded-[10px] 
        bg-white
        border-4
        border-black
        ${className}
    `}>
            <input
                id="game-input"
                type="text"
                placeholder={placeholder}
                readOnly={readonly}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                ref={inputRef}
                autoComplete="off"
                className="
            w-[420px] 
            h-[40px] 
            text-xl 
            bg-transparent 
            border-none 
            outline-none 
            text-black 
            placeholder-gray-400
            px-2
            "
            />
        </div>
    );
};

export default GameInput;