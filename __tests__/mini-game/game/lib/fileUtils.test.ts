import { parseWordsFromFile } from '@/app/mini-game/game/lib/fileUtils';

describe('fileUtils', () => {
    describe('parseWordsFromFile', () => {
        it('should throw error if file size exceeds 1MB', async () => {
            const file = new File(['a'.repeat(1024 * 1024 + 1)], 'test.txt', { type: 'text/plain' });
            await expect(parseWordsFromFile(file)).rejects.toThrow('파일 크기는 1MB를 초과할 수 없습니다.');
        });

        it('should throw error if file extension is not .txt', async () => {
            const file = new File(['content'], 'test.csv', { type: 'text/csv' });
            await expect(parseWordsFromFile(file)).rejects.toThrow('txt 파일만 업로드 가능합니다.');
        });

        it('should parse words correctly', async () => {
            const content = 'Apple\nBanana\nC\nHello World!';
            const file = new File([content], 'words.txt', { type: 'text/plain' });
            // Mock text() method since jsdom File might not support it
            Object.defineProperty(file, 'text', {
                value: async () => content
            });
            
            const result = await parseWordsFromFile(file);
            
            // "C" is filtered out because length <= 1
            // "Hello World!" -> "helloworld" (special chars removed, lowercase)
            expect(result).toEqual(['apple', 'banana', 'helloworld']);
        });

        it('should remove special characters and convert to lowercase', async () => {
            const content = 'Ap@#ple\nBa_na-na';
            const file = new File([content], 'words.txt', { type: 'text/plain' });
            Object.defineProperty(file, 'text', {
                value: async () => content
            });
            
            const result = await parseWordsFromFile(file);
            
            expect(result).toEqual(['apple', 'banana']);
        });
    });
});