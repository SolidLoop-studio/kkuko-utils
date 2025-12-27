import * as wordDB from '@/app/mini-game/game/lib/wordDB';
import { openDB } from 'idb';

jest.mock('idb');

describe('wordDB', () => {
    const mockDB = {
        transaction: jest.fn(),
        getAll: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        clear: jest.fn(),
        objectStoreNames: {
            contains: jest.fn(),
        },
        createObjectStore: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (openDB as jest.Mock).mockResolvedValue(mockDB);
    });

    it('should load words from file', async () => {
        const file = new File(['word1\nword2'], 'test.txt', { type: 'text/plain' });
        Object.defineProperty(file, 'text', {
            value: () => Promise.resolve('word1\nword2')
        });

        const mockTx = {
            objectStore: jest.fn().mockReturnValue({
                put: jest.fn(),
            }),
            done: Promise.resolve(),
        };
        mockDB.transaction.mockReturnValue(mockTx);

        const count = await wordDB.loadWordsFromFile(file);
        
        expect(openDB).toHaveBeenCalled();
        expect(mockDB.transaction).toHaveBeenCalledWith('words', 'readwrite');
        expect(mockTx.objectStore).toHaveBeenCalledWith('words');
        // word1, word2 are valid.
        expect(mockTx.objectStore().put).toHaveBeenCalledTimes(2);
        expect(count).toBe(2);
    });

    it('should throw error if file is too large', async () => {
        const file = new File([''], 'test.txt', { type: 'text/plain' });
        Object.defineProperty(file, 'size', { value: 1024 * 1024 + 1 });

        await expect(wordDB.loadWordsFromFile(file)).rejects.toThrow('파일 크기는 1MB를 초과할 수 없습니다.');
    });

    it('should throw error if file is not txt', async () => {
        const file = new File(['content'], 'test.png', { type: 'image/png' });
        await expect(wordDB.loadWordsFromFile(file)).rejects.toThrow('txt 파일만 업로드 가능합니다.');
    });

    it('should get all words', async () => {
        const mockWords = [
            { word: '나비', theme: '자유' },
            { word: '가방', theme: '자유' },
        ];
        mockDB.getAll.mockResolvedValue(mockWords);

        const words = await wordDB.getAllWords();
        
        expect(mockDB.getAll).toHaveBeenCalledWith('words');
        expect(words[0].word).toBe('가방'); // Sorted
        expect(words[1].word).toBe('나비');
    });

    it('should search words by prefix', async () => {
        const mockWords = [
            { word: '가방', theme: '자유' },
            { word: '가위', theme: '자유' },
            { word: '나비', theme: '자유' },
        ];
        mockDB.getAll.mockResolvedValue(mockWords);

        const results = await wordDB.searchWordsByPrefix('가');
        expect(results.length).toBe(2);
        expect(results[0].word).toBe('가방');
        expect(results[1].word).toBe('가위');
    });

    it('should update word', async () => {
        const mockTx = {
            objectStore: jest.fn().mockReturnValue({
                delete: jest.fn(),
                put: jest.fn(),
            }),
            done: Promise.resolve(),
        };
        mockDB.transaction.mockReturnValue(mockTx);

        await wordDB.updateWord('old', 'new');
        
        expect(mockTx.objectStore().delete).toHaveBeenCalledWith('old');
        expect(mockTx.objectStore().put).toHaveBeenCalledWith({ word: 'new', theme: '자유' });
    });

    it('should delete word', async () => {
        await wordDB.deleteWord('word');
        expect(mockDB.delete).toHaveBeenCalledWith('words', 'word');
    });

    it('should add word', async () => {
        await wordDB.addWord('word');
        expect(mockDB.put).toHaveBeenCalledWith('words', { word: 'word', theme: '자유' });
    });

    it('should check if has words', async () => {
        mockDB.count.mockResolvedValue(1);
        const has = await wordDB.hasWords();
        expect(has).toBe(true);
        expect(mockDB.count).toHaveBeenCalledWith('words');
    });

    it('should clear all words', async () => {
        await wordDB.clearAllWords();
        expect(mockDB.clear).toHaveBeenCalledWith('words');
    });
});