import { calculateTypingTargetViewport } from '@/src/app/mini-game/game/typing-practice/lib/typing-target-viewport';

describe('calculateTypingTargetViewport', () => {
    it('keeps a fitting target stationary with no hidden edges', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 300,
            activeLeft: 100,
            activeWidth: 20,
        })).toEqual({
            translateX: 0,
            hasHiddenStart: false,
            hasHiddenEnd: false,
        });
    });

    it('clamps a long target at the beginning', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 2000,
            activeLeft: 0,
            activeWidth: 20,
        })).toEqual({
            translateX: 0,
            hasHiddenStart: false,
            hasHiddenEnd: true,
        });
    });

    it('anchors a middle character at 36 percent of the viewport', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 2000,
            activeLeft: 1000,
            activeWidth: 20,
        })).toEqual({
            translateX: -866,
            hasHiddenStart: true,
            hasHiddenEnd: true,
        });
    });

    it('clamps a long target at the end', () => {
        expect(calculateTypingTargetViewport({
            viewportWidth: 400,
            trackWidth: 2000,
            activeLeft: 1980,
            activeWidth: 20,
        })).toEqual({
            translateX: -1600,
            hasHiddenStart: true,
            hasHiddenEnd: false,
        });
    });
});
