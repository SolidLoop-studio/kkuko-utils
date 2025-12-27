import { WordService } from "@/app/mini-game/game/services/WordService";

describe('WordService', () => {
    let wordService: WordService;

    beforeEach(() => {
        wordService = WordService.getInstance();
        wordService.clearDB();
    });

    it('should be a singleton', () => {
        const instance1 = WordService.getInstance();
        const instance2 = WordService.getInstance();
        expect(instance1).toBe(instance2);
    });

    describe('loadWordDB', () => {
        it('should load words correctly', () => {
            const data = [
                { word: 'apple', theme: ['fruit'] },
                { word: 'banana', theme: ['fruit'] },
                { word: '가방', theme: ['object'] }
            ];
            wordService.loadWordDB(data);

            expect(wordService.hasWord('apple')).toBe(true);
            expect(wordService.hasWord('banana')).toBe(true);
            expect(wordService.hasWord('가방')).toBe(true);
            expect(wordService.hasWord('grape')).toBe(false);
        });

        it('should filter out invalid words', () => {
            const data = [
                { word: 'a', theme: [] }, // too short
                { word: '!', theme: [] }, // special char only
                { word: 'valid', theme: [] }
            ];
            wordService.loadWordDB(data);

            expect(wordService.hasWord('a')).toBe(false);
            expect(wordService.hasWord('!')).toBe(false);
            expect(wordService.hasWord('valid')).toBe(true);
        });
    });

    describe('addWordToDB', () => {
        it('should add a new word', () => {
            const result = wordService.addWordToDB('newword', ['test']);
            expect(result).toBe(true);
            expect(wordService.hasWord('newword')).toBe(true);
        });

        it('should not add duplicate word', () => {
            wordService.addWordToDB('word', ['test']);
            const result = wordService.addWordToDB('word', ['test']);
            expect(result).toBe(false);
        });

        it('should not add invalid word', () => {
            const result = wordService.addWordToDB('a', ['test']);
            expect(result).toBe(false);
        });
    });

    describe('editWordInDB', () => {
        beforeEach(() => {
            wordService.addWordToDB('oldword', ['test']);
        });

        it('should edit an existing word', () => {
            const result = wordService.editWordInDB('oldword', 'newword');
            expect(result).toBe(true);
            expect(wordService.hasWord('oldword')).toBe(false);
            expect(wordService.hasWord('newword')).toBe(true);
        });

        it('should fail if old word does not exist', () => {
            const result = wordService.editWordInDB('nonexistent', 'newword');
            expect(result).toBe(false);
        });

        it('should fail if new word is invalid', () => {
            const result = wordService.editWordInDB('oldword', 'a');
            expect(result).toBe(false);
        });
    });

    describe('deleteWordFromDB', () => {
        beforeEach(() => {
            wordService.addWordToDB('todelete', ['test']);
        });

        it('should delete an existing word', () => {
            const result = wordService.deleteWordFromDB('todelete');
            expect(result).toBe(true);
            expect(wordService.hasWord('todelete')).toBe(false);
        });

        it('should fail if word does not exist', () => {
            const result = wordService.deleteWordFromDB('nonexistent');
            expect(result).toBe(false);
        });
    });

    describe('getWordTheme', () => {
        it('should return themes for a word', () => {
            wordService.addWordToDB('themedword', ['theme1', 'theme2']);
            const themes = wordService.getWordTheme('themedword');
            expect(themes).toEqual(['theme1', 'theme2']);
        });

        it('should return empty array for nonexistent word', () => {
            const themes = wordService.getWordTheme('nonexistent');
            expect(themes).toEqual([]);
        });
    });
});