"use client";

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TypingPracticeLogic } from './lib/TypingPracticeLogic';
import {
    calculateTypingTargetViewport,
    type TypingTargetViewportLayout,
} from './lib/typing-target-viewport';

type Props = {
    target: string;
    input: string;
    isComposing: boolean;
};

const initialLayout: TypingTargetViewportLayout = {
    translateX: 0,
    hasHiddenStart: false,
    hasHiddenEnd: false,
};

const TypingTargetViewport = ({ target, input, isComposing }: Props) => {
    const normalizedTarget = TypingPracticeLogic.normalizeWord(target);
    const normalizedInput = TypingPracticeLogic.normalizeWord(input);
    const targetCharacters = useMemo(() => Array.from(normalizedTarget), [normalizedTarget]);
    const inputCharacters = useMemo(() => Array.from(normalizedInput), [normalizedInput]);
    const viewportRef = useRef<HTMLDivElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState<TypingTargetViewportLayout>(initialLayout);
    const activeIndex = Math.min(
        isComposing ? Math.max(inputCharacters.length - 1, 0) : inputCharacters.length,
        Math.max(targetCharacters.length - 1, 0),
    );

    const measure = useCallback(() => {
        const viewport = viewportRef.current;
        const track = trackRef.current;
        const activeCharacter = track
            ?.querySelectorAll<HTMLElement>('[data-testid="typing-target-character"]')
            .item(activeIndex);
        if (!viewport || !track || !activeCharacter) {
            setLayout(initialLayout);
            return;
        }

        setLayout(calculateTypingTargetViewport({
            viewportWidth: viewport.clientWidth,
            trackWidth: track.scrollWidth,
            activeLeft: activeCharacter.offsetLeft,
            activeWidth: activeCharacter.offsetWidth,
        }));
    }, [activeIndex]);

    useLayoutEffect(() => {
        measure();
        const observer = new ResizeObserver(measure);
        if (viewportRef.current) observer.observe(viewportRef.current);
        if (trackRef.current) observer.observe(trackRef.current);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [measure, normalizedTarget]);

    const activeComposingIndex = isComposing ? inputCharacters.length - 1 : -1;
    const hasExtraInput = inputCharacters.length > targetCharacters.length;
    const isOverflowing = layout.hasHiddenStart || layout.hasHiddenEnd;

    return (
        <div className="flex h-full w-full items-center gap-2">
            <div
                ref={viewportRef}
                data-testid="typing-target-viewport"
                className={`relative min-w-0 flex-1 overflow-hidden ${isOverflowing ? 'text-left' : 'text-center'}`}
            >
                {layout.hasHiddenStart && (
                    <span data-testid="typing-target-overflow-start" aria-hidden="true" className="absolute inset-y-0 left-0 z-10 flex items-center bg-gradient-to-r from-black/70 to-transparent pr-5">‹</span>
                )}
                <div
                    ref={trackRef}
                    data-testid="typing-target-track"
                    className="inline-flex whitespace-nowrap transition-transform motion-reduce:transition-none"
                    style={{ transform: `translateX(${layout.translateX}px)` }}
                >
                    <span className="sr-only">{normalizedTarget}</span>
                    {targetCharacters.map((char, index) => {
                        const typed = inputCharacters[index];
                        const className = typed === undefined
                            ? 'text-[#EEEEEE]'
                            : isComposing && index === activeComposingIndex
                                ? 'text-yellow-200'
                                : typed === char
                                    ? 'text-green-300'
                                    : 'text-red-300 underline';
                        return <span key={`${char}-${index}`} data-testid="typing-target-character" className={className} aria-hidden="true">{char}</span>;
                    })}
                    {hasExtraInput && <span className="text-red-300 underline" aria-hidden="true">!</span>}
                </div>
                {layout.hasHiddenEnd && (
                    <span data-testid="typing-target-overflow-end" aria-hidden="true" className="absolute inset-y-0 right-0 z-10 flex items-center bg-gradient-to-l from-black/70 to-transparent pl-5">›</span>
                )}
            </div>
            <span data-testid="typing-target-count" className="w-[66px] shrink-0 text-right text-[12px] text-[#EEEEEE]">
                {inputCharacters.length} / {targetCharacters.length}
            </span>
        </div>
    );
};

export default TypingTargetViewport;
