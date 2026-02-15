"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface HistoryItemProps {
    theme?: string[];
    className?: string;
    word: string;
    meaning?: string;
    wordType?: 'm1' | 'm2' | 'm3';
    wordTheme?: string;
}

interface TooltipPortalProps {
    children: React.ReactNode;
    style?: React.CSSProperties;
    portalId?: string;
    initialLeft?: number;
    targetTop?: number;
    targetBottom?: number;
}

/**
 * 툴팁을 포탈로 렌더링하는 컴포넌트
 * 부모 요소의 overflow: hidden 제약을 벗어나기 위해 사용합니다.
 */
const TooltipPortal = ({ children, style, portalId, initialLeft, targetTop, targetBottom }: TooltipPortalProps) => {
    const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
    const innerRef = useRef<HTMLDivElement | null>(null);
    const [appliedStyle, setAppliedStyle] = useState<React.CSSProperties | null>(null);

    useEffect(() => {
        let node = document.getElementById(portalId || 'history-tooltip-root');
        let created = false;
        if (!node) {
            node = document.createElement('div');
            node.id = portalId || 'history-tooltip-root';
            document.body.appendChild(node);
            created = true;
        }
        setMountNode(node);
        return () => {
            if (created && node && node.parentNode) node.parentNode.removeChild(node);
        };
    }, [portalId]);

    useEffect(() => {
        // 스타일이 직접 제공된 경우 폴백으로 사용
        if (style && initialLeft === undefined && targetTop === undefined) {
            setAppliedStyle(style);
            return;
        }

        // 마운트 후 내부 콘텐츠 크기를 측정하고 뷰포트 내에 유지되도록 위치 조정
        const measureAndAdjust = () => {
            const el = innerRef.current;
            if (!el || typeof initialLeft !== 'number' || typeof targetTop !== 'number' || typeof targetBottom !== 'number') return;
            const rect = el.getBoundingClientRect();
            const winW = window.innerWidth;
            const margin = 8;
            const tooltipW = Math.min(rect.width, Math.max(0, winW - margin * 2));

            // 툴팁이 뷰포트 내에 머물도록 x 좌표 클램핑
            let left = initialLeft;
            left = Math.max(left, margin + tooltipW / 2);
            left = Math.min(left, winW - margin - tooltipW / 2);

            // 타겟 위에 표시할지 아래에 표시할지 결정
            const tooltipH = rect.height;
            // 위쪽 공간이 충분하면 위에 표시
            if (targetTop - margin - tooltipH >= margin) {
                const top = targetTop - margin; // translateY(-100%)로 바닥 정렬
                setAppliedStyle({ position: 'fixed', left, top, transform: 'translateX(-50%) translateY(-100%)', zIndex: 9999 });
            } else {
                // 아래에 표시
                const top = targetBottom + margin;
                setAppliedStyle({ position: 'fixed', left, top, transform: 'translateX(-50%)', zIndex: 9999 });
            }
        };

        // DOM 업데이트 보장을 위해 다음 프레임에 측정
        const id = requestAnimationFrame(measureAndAdjust);
        // 리사이즈/스크롤 시 재측정
        window.addEventListener('resize', measureAndAdjust);
        window.addEventListener('scroll', measureAndAdjust, true);
        return () => {
            cancelAnimationFrame(id);
            window.removeEventListener('resize', measureAndAdjust);
            window.removeEventListener('scroll', measureAndAdjust, true);
        };
    }, [style, initialLeft, targetTop, children]);

    if (!mountNode) return null;

    return createPortal(
        <div ref={innerRef} style={appliedStyle || style || undefined} className="pointer-events-none">
            {children}
        </div>,
        mountNode
    );
};

/**
 * 히스토리 아이템 컴포넌트
 * 사용된 단어 정보를 표시하고 호버 시 상세 정보를 툴팁으로 보여줍니다.
 */
const HistoryItem = ({
    theme,
    className,
    word,
    meaning,
    wordType,
    wordTheme
}: HistoryItemProps) => {
    const getWordHeadStyle = () => {
        switch (wordType) {
            case 'm1':
                return 'px-0.5 mx-0.5 text-black font-bold bg-gray-300';
            case 'm2':
                return 'text-green-400';
            case 'm3':
                return 'text-gray-200 before:content-["("] after:content-[")"]';
            default:
                return '';
        }
    };

    const ref = useRef<HTMLDivElement | null>(null);
    const [hover, setHover] = useState(false);
    const [coords, setCoords] = useState({ left: 0, top: 0, bottom: 0 });

    const handleEnter = (e: React.MouseEvent) => {
        setCoords({ left: e.clientX, top: e.clientY, bottom: e.clientY });
        setHover(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setCoords({ left: e.clientX, top: e.clientY, bottom: e.clientY });
    };

    const handleLeave = () => setHover(false);

    return (
        <div ref={ref} onMouseEnter={handleEnter} onMouseMove={handleMouseMove} onMouseLeave={handleLeave} className="relative group h-10 w-[170px] px-3 py-1 rounded-lg m-1 text-gray-200 text-center bg-gray-800 flex flex-col justify-center items-center overflow-hidden cursor-pointer">
            {/* 첫 번째 줄: 단어 + 품사 */}
            <div className="flex items-center w-full overflow-hidden justify-center">
                <span className={`mr-1 ${getWordHeadStyle()} truncate max-w-[230px] text-center text-[14px]`}>
                    {word}
                </span>
                {className && (
                    <span className="rounded ml-1 text-[10px] text-black bg-blue-400 truncate max-w-[32px]">
                        {className}
                    </span>
                )}
            </div>

            {/* 두 번째 줄: 주제 + 뜻 */}
            <div className="flex items-center text-xs overflow-hidden">
                {theme && theme.length > 0 && (
                    theme.map((t, index) => (
                        <span key={index} className="mx-1 text-sky-300">
                            &lt;{t}&gt; {index < theme.length - 1 ? ',' : ''}
                        </span>
                    ))
                )}

                {wordTheme && (
                    <span className="text-sky-300 before:content-['<'] after:content-['>']">
                        {wordTheme}
                    </span>
                )}

                {meaning && (
                    <span className="px-0.5 pt-0.5 pb-0 pl-0.5 text-gray-400 truncate">
                        {meaning}
                    </span>
                )}
            </div>

            {/* 호버 툴팁: 포탈로 렌더링하여 오버플로우 제약 회피 */}
            {hover && (
                <TooltipPortal initialLeft={coords.left} targetTop={coords.top} targetBottom={coords.bottom}>
                    <div className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl border-2 border-gray-600 whitespace-normal break-words break-all max-w-[420px]">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-base font-semibold ${getWordHeadStyle()} break-all`}>
                                {word}
                            </span>
                            {className && (
                                <span className="rounded px-2 py-0.5 text-xs text-black bg-blue-400">
                                    {className}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                            {theme && theme.length > 0 && (
                                <span className="text-sky-300 break-words">
                                    &lt;{theme.join(', ')}&gt;
                                </span>
                            )}
                            {wordTheme && (
                                <span className="text-sky-300 break-words">
                                    &lt;{wordTheme}&gt;
                                </span>
                            )}
                            {meaning && (
                                <span className="text-gray-300 break-words">
                                    {meaning}
                                </span>
                            )}
                        </div>
                    </div>
                </TooltipPortal>
            )}
        </div>
    );
};

/**
 * 히스토리 목록 컨테이너
 * 사용된 단어들의 목록을 가로 스크롤 가능한 영역에 표시합니다.
 */
const HistoryHolder = ({ historyItems }: { historyItems: { theme: string[]; word: string }[] }) => {
    return (
        <div className="w-[990px] h-10 relative">
            <div className="w-[1200px] h-[42px] flex items-center overflow-x-auto overflow-y-hidden">
                {historyItems.map((item, index) => (
                    <HistoryItem key={index} {...item} />
                ))}
            </div>
        </div>
    );
};

export default HistoryHolder;