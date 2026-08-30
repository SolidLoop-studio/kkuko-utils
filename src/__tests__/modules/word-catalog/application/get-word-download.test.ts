import { err, ok } from '../../../../shared/application/result';
import { GetWordDownloadService } from '../../../../modules/word-catalog/application/get-word-download';
import type { WordDownloadQueryGateway } from '../../../../modules/word-catalog/application/word-download-ports';
import type { WordDownloadFilter, WordDownloadSource } from '../../../../modules/word-catalog/application/word-download-types';

const allWordClasses: WordDownloadFilter = {
    includeAdded: false,
    includeDeleted: false,
    includeAcknowledged: true,
    includeNotAcknowledged: true,
    onlyWordChain: false,
};

const source: WordDownloadSource = {
    registeredWords: [
        { word: '가나', isNoInjung: false, canUseInWordChain: true },
        { word: '나다', isNoInjung: true, canUseInWordChain: false },
    ],
    pendingRequests: [
        { word: '가나', type: 'add' },
        { word: '다라', type: 'add' },
        { word: '나다', type: 'delete' },
    ],
};

const createGateway = (): jest.Mocked<WordDownloadQueryGateway> => ({
    load: jest.fn().mockResolvedValue(ok(source)),
});

describe('GetWordDownloadService', () => {
    test('projects selected registered words and their statistics', async () => {
        const gateway = createGateway();
        const service = new GetWordDownloadService(gateway);

        await expect(service.get(allWordClasses)).resolves.toEqual(ok({
            words: ['가나', '나다'],
            stats: {
                totalCount: 2,
                acknowledgedCount: 1,
                notAcknowledgedCount: 1,
                addedCount: 0,
                deletedCount: 0,
                wordChainCount: 1,
                wordNotChainCount: 1,
            },
        }));
        expect(gateway.load).toHaveBeenCalledWith({
            includeAcknowledged: true,
            includeNotAcknowledged: true,
            onlyWordChain: false,
        });
    });

    test('includes pending additions only when requested', async () => {
        const service = new GetWordDownloadService(createGateway());

        await expect(service.get({ ...allWordClasses, includeAdded: true })).resolves.toEqual(ok({
            words: ['가나', '나다', '다라'],
            stats: {
                totalCount: 3,
                acknowledgedCount: 1,
                notAcknowledgedCount: 1,
                addedCount: 2,
                deletedCount: 0,
                wordChainCount: 1,
                wordNotChainCount: 1,
            },
        }));
    });

    test('removes registered words with pending deletions only when requested', async () => {
        const service = new GetWordDownloadService(createGateway());

        await expect(service.get({ ...allWordClasses, includeDeleted: true })).resolves.toEqual(ok({
            words: ['가나'],
            stats: {
                totalCount: 1,
                acknowledgedCount: 1,
                notAcknowledgedCount: 0,
                addedCount: 0,
                deletedCount: 1,
                wordChainCount: 1,
                wordNotChainCount: 0,
            },
        }));
    });

    test('deduplicates words shared by registered and pending addition data', async () => {
        const service = new GetWordDownloadService(createGateway());

        const result = await service.get({ ...allWordClasses, includeAdded: true });

        expect(result.ok && result.value.words).toEqual(['가나', '나다', '다라']);
    });

    test('sorts selected words in Korean order', async () => {
        const gateway = createGateway();
        gateway.load.mockResolvedValue(ok({
            registeredWords: [
                { word: '하나', isNoInjung: false, canUseInWordChain: true },
                { word: '가나', isNoInjung: false, canUseInWordChain: true },
            ],
            pendingRequests: [],
        }));

        const result = await new GetWordDownloadService(gateway).get(allWordClasses);

        expect(result.ok && result.value.words).toEqual(['가나', '하나']);
    });

    test('rejects a filter without either word class before querying', async () => {
        const gateway = createGateway();

        await expect(new GetWordDownloadService(gateway).get({
            ...allWordClasses,
            includeAcknowledged: false,
            includeNotAcknowledged: false,
        })).resolves.toEqual(err({
            kind: 'validation',
            message: '어인정 단어 허용, 노인정 단어 허용 중 최소 하나는 선택해야 합니다.',
        }));
        expect(gateway.load).not.toHaveBeenCalled();
    });

    test('returns gateway failures unchanged', async () => {
        const gateway = createGateway();
        const failure = err({ kind: 'infrastructure', message: 'failed' });
        gateway.load.mockResolvedValue(failure);

        await expect(new GetWordDownloadService(gateway).get(allWordClasses)).resolves.toEqual(failure);
    });
});
