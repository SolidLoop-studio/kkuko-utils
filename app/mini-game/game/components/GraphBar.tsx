import React from 'react';

interface GraphBarProps {
    className: string;
    min?: number;
    val?: number;
    max?: number;
    bgc?: string;
    noTransition?: boolean;
    label?: string;
}

/**
 * 진행 상태를 나타내는 그래프 바 컴포넌트
 */
const GraphBar = ({ className, min = 0, val = 0, max = 100, bgc, label, noTransition = false }: GraphBarProps) => {
    const range = max - min || 1;
    const percentage = Math.max(0, Math.min(100, ((val - min) / range) * 100));

    return (
        <div className={`${className} text-white text-right overflow-hidden`}>
            <div
                className="pt-[4px] h-[20px] text-[11px] whitespace-nowrap overflow-hidden"
                style={{
                    width: `${percentage}%`,
                    backgroundColor: bgc || undefined,
                    transition: noTransition ? 'none' : 'width 120ms linear',
                    willChange: 'width'
                }}
            >
                {label}
            </div>
        </div>
    );
};

export default GraphBar;