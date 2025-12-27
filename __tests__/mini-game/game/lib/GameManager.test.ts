import gameManager from '@/app/mini-game/game/lib/GameManager';

describe('GameManager', () => {
    beforeEach(() => {
        gameManager.clearDB();
        gameManager.updateSetting({
            lang: 'ko',
            mode: 'normal',
            hintMode: 'auto',
            notAgainSameChar: false,
            roundTime: 60000,
            wantStartChar: new Set()
        });
        jest.restoreAllMocks();
    });

    it('should be a singleton', () => {
        expect(gameManager).toBeDefined();
    });

    it('should load word DB correctly', () => {
        const words = [
            { word: '가방', theme: ['자유'] },
            { word: '나비', theme: ['자유'] },
            { word: 'apple', theme: ['english'] }
        ];
        gameManager.loadWordDB(words, {});
        
        gameManager.updateSetting({ lang: 'ko', mode: 'normal' });
        expect(gameManager.canGameStart()).toBe(true);
        
        gameManager.updateSetting({ lang: 'en', mode: 'normal' });
        expect(gameManager.canGameStart()).toBe(true);
    });

    it('should handle game flow (normal mode)', () => {
        const words = [
            { word: '가방', theme: ['자유'] },
            { word: '방구', theme: ['자유'] }
        ];
        gameManager.loadWordDB(words, { lang: 'ko', mode: 'normal' });
        
        const startState = gameManager.gameStart();
        expect(['가', '방']).toContain(startState.startChar);
        
        let wordToSubmit = '';
        if (startState.startChar === '가') wordToSubmit = '가방';
        else if (startState.startChar === '방') wordToSubmit = '방구';
        
        const result = gameManager.submitWord(wordToSubmit, 50000);
        if (result.ok) {
            expect(result.ok).toBe(true);
            expect(typeof result.nextChar).toBe('string');
            expect(result.nextChar.length).toBeGreaterThan(0);
        } else {
            fail('Submit word failed');
        }
    });

    it('should handle duem law', () => {
        // '리본' starts with '리'. '이발' starts with '이'.
        // '리' -> '이' via duem law.
        const words = [
            { word: '리본', theme: ['자유'] },
            { word: '이발', theme: ['자유'] }
        ];
        gameManager.loadWordDB(words, { lang: 'ko', mode: 'normal' });
        
        // Force start char to '리' by mocking Math.random if needed, 
        // or just retry until we get '리' (but that's flaky).
        // Better: clear DB and load only '리본' first to force start char '리', 
        // then add '이발' dynamically? No, gameStart picks from existing DB.
        
        // Let's mock Math.random to pick the index corresponding to '리'.
        // We don't know the order in Set.
        // But we can check the start char and if it is '리', submit '이발'.
        // If it is '이', submit '리본' (Wait, '이' -> '리' is not duem law, duem law is one way usually? 
        // Actually duemLaw function converts '리' to '이'.
        // isValidWord checks: [startChar, duemLaw(startChar)].includes(word[0])
        // So if startChar is '리', word can start with '리' or '이'.
        // If startChar is '이', word can start with '이' or duemLaw('이')='이'.
        
        // So we need startChar='리'.
        
        // Hack: Load only '리본'. Start game. Then add '이발'.
        gameManager.clearDB();
        gameManager.loadWordDB([{ word: '리본', theme: ['자유'] }], { lang: 'ko', mode: 'normal' });
        const startState = gameManager.gameStart();
        expect(startState.startChar).toBe('리');
        
        gameManager.addWordToDB('이발', ['자유']);
        
        const result = gameManager.submitWord('이발', 50000);
        expect(result.ok).toBe(true);
    });

    it('should add/edit/delete words', () => {
        gameManager.addWordToDB('테스트', ['테마']);
        
        // Check if added by trying to start game with it
        gameManager.updateSetting({ lang: 'ko', mode: 'normal' });
        const startState = gameManager.gameStart();
        expect(startState.startChar).toBe('테');
        
        // Edit
        gameManager.editWordInDB('테스트', '수정된');
        // Now start char should be '수' (if we restart game or check DB)
        // Note: gameStart resets state based on current DB.
        const startState2 = gameManager.gameStart();
        expect(startState2.startChar).toBe('수');
        
        // Delete
        gameManager.deleteWordFromDB('수정된');
        expect(gameManager.canGameStart()).toBe(false);
    });

    it('should handle mission mode', () => {
        // Mission mode: start char and mission char.
        // Word must include mission char.
        const words = [
            { word: '가방', theme: ['자유'] } // Contains '가', '방'
        ];
        gameManager.loadWordDB(words, { lang: 'ko', mode: 'mission' });
        
        const startState = gameManager.gameStart();
        expect(startState.startChar).toBe('가');
        expect(startState.missionChar).toMatch(/[가방]/);
        
        const result = gameManager.submitWord('가방', 50000);
        expect(result.ok).toBe(true);
    });

    it('should fail if mission char is missing in mission mode', () => {
        const words = [
            { word: '가방', theme: ['자유'] }, // Contains '가', '방'
            { word: '가위', theme: ['자유'] }  // Contains '가', '위'
        ];
        // We want startChar='가', missionChar='방'.
        // '가위' does not have '방'.
        
        // Force mission char to be '방'.
        // We can filter DB to only have words with '방' to force it? 
        // No, MissionStartCharSet contains [start, mission] pairs.
        // If we have '가방', pairs are ('가', '가'), ('가', '방').
        
        // Let's just check the result reason if we fail.
        gameManager.loadWordDB(words, { lang: 'ko', mode: 'mission' });
        
        // Try until we get a mission char that is NOT in '가위' (e.g. '방')
        // Or just mock Math.random.
        
        // Let's try to submit '가위' when mission char is '방'.
        // We can manually set `nowState` if we could, but it's private.
        // We can loop gameStart until we get desired state?
        
        let found = false;
        for(let i=0; i<100; i++) {
            const state = gameManager.gameStart();
            if (state.startChar === '가' && state.missionChar === '방') {
                found = true;
                break;
            }
        }
        
        if (found) {
            const result = gameManager.submitWord('가위', 50000);
            expect(result.ok).toBe(false);
            if (!result.ok) { // Type guard
                expect(result.reason).toBe('미션 글자 미포함!');
            }
        }
    });

    it('should provide hints', () => {
        const words = [
            { word: '가방', theme: ['자유'] }
        ];
        gameManager.loadWordDB(words, { lang: 'ko', mode: 'normal', hintMode: 'auto' });
        gameManager.gameStart();
        
        const hint = gameManager.getHint();
        expect(hint).toBe('가방');
        
        const hintWord = gameManager.getHintWord();
        // hintStack 0 -> disassembled first char? No, loop over word length.
        // hintWord is '가방'.
        // hintStack 0: disassemble('가')[0] + disassemble('방')[0] = 'ㄱ' + 'ㅂ'
        expect(hintWord).toBe('ㄱㅂ');
    });
});