export type TypingTargetViewportMeasurement = {
    viewportWidth: number;
    trackWidth: number;
    activeLeft: number;
    activeWidth: number;
    anchorRatio?: number;
};

export type TypingTargetViewportLayout = {
    translateX: number;
    hasHiddenStart: boolean;
    hasHiddenEnd: boolean;
};

export const TYPING_TARGET_ANCHOR_RATIO = 0.36;

export const calculateTypingTargetViewport = ({
    viewportWidth,
    trackWidth,
    activeLeft,
    activeWidth,
    anchorRatio = TYPING_TARGET_ANCHOR_RATIO,
}: TypingTargetViewportMeasurement): TypingTargetViewportLayout => {
    if (viewportWidth <= 0 || trackWidth <= viewportWidth) {
        return {
            translateX: 0,
            hasHiddenStart: false,
            hasHiddenEnd: false,
        };
    }

    const minimumTranslateX = viewportWidth - trackWidth;
    const desiredTranslateX = (viewportWidth * anchorRatio) - (activeLeft + activeWidth / 2);
    const translateX = Math.min(0, Math.max(minimumTranslateX, desiredTranslateX));

    return {
        translateX,
        hasHiddenStart: translateX < 0,
        hasHiddenEnd: trackWidth + translateX > viewportWidth,
    };
};
