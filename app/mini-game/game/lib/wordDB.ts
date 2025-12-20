import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { parseWordsFromFile } from './fileUtils';

interface WordDBSchema extends DBSchema {
    words: {
        key: string;
        value: {
            word: string;
            theme: string;
        };
    };
}

const DB_NAME = 'KkutuWordDB';
const DB_VERSION = 1;
const STORE_NAME = 'words';

let dbInstance: IDBPDatabase<WordDBSchema> | null = null;

/**
 * IndexedDB 데이터베이스를 초기화합니다.
 * Singleton 패턴과 유사하게 인스턴스를 재사용합니다.
 */
async function initDB(): Promise<IDBPDatabase<WordDBSchema>> {
    if (dbInstance) return dbInstance;

    dbInstance = await openDB<WordDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'word' });
            }
        },
    });

    return dbInstance;
}

/**
 * txt 파일에서 단어를 파싱하여 IndexedDB에 저장합니다.
 * @param file - 업로드된 텍스트 파일
 * @returns 저장된 단어 개수
 */
export async function loadWordsFromFile(file: File): Promise<number> {
    const words = await parseWordsFromFile(file);

    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    let count = 0;
    for (const word of words) {
        await store.put({ word, theme: '자유' });
        count++;
    }

    await tx.done;
    return count;
}

/**
 * IndexedDB에서 모든 단어를 가져옵니다.
 * @returns 단어 배열 (ㄱㄴㄷ순 정렬)
 */
export async function getAllWords(): Promise<Array<{ word: string; theme: string }>> {
    const db = await initDB();
    const words = await db.getAll(STORE_NAME);

    // 한글 자음 순서로 정렬
    return words.sort((a, b) => a.word.localeCompare(b.word, 'ko'));
}

/**
 * 접두사로 단어를 검색합니다.
 * @param prefix - 검색할 접두사
 * @returns 일치하는 단어 배열
 */
export async function searchWordsByPrefix(prefix: string): Promise<Array<{ word: string; theme: string }>> {
    const allWords = await getAllWords();
    return allWords.filter(item => item.word.startsWith(prefix));
}

/**
 * 단어를 수정합니다.
 * @param oldWord - 기존 단어
 * @param newWord - 새로운 단어
 */
export async function updateWord(oldWord: string, newWord: string): Promise<void> {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await store.delete(oldWord);
    await store.put({ word: newWord, theme: '자유' });
    await tx.done;
}

/**
 * 단어를 삭제합니다.
 * @param word - 삭제할 단어
 */
export async function deleteWord(word: string): Promise<void> {
    const db = await initDB();
    await db.delete(STORE_NAME, word);
}

/**
 * 단어를 추가합니다.
 * @param word - 추가할 단어
 */
export async function addWord(word: string): Promise<void> {
    const db = await initDB();
    await db.put(STORE_NAME, { word, theme: '자유' });
}

/**
 * 저장된 단어가 있는지 확인합니다.
 */
export async function hasWords(): Promise<boolean> {
    const db = await initDB();
    const count = await db.count(STORE_NAME);
    return count > 0;
}

/**
 * 모든 단어를 삭제합니다.
 */
export async function clearAllWords(): Promise<void> {
    const db = await initDB();
    await db.clear(STORE_NAME);
}