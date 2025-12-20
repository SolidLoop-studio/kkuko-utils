import React from 'react';

/**
 * 게임 화면의 배경 및 컨테이너 역할을 하는 컴포넌트
 */
const GameBox = ({ children }: { children: React.ReactNode }) => {
    return (
        <div
            className="w-[1000px] h-[410px] bg-[url('/img/gamebg.png')]"
        >
            {children}
        </div>
    );
};

export default GameBox;