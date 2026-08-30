import { err, ok, type Result } from '../../../shared/application/result';
import type { WordDownloadQueryGateway } from './word-download-ports';
import type {
    WordDownloadData,
    WordDownloadFilter,
    WordDownloadRegisteredWord,
} from './word-download-types';

const invalidWordClassError = () => err<WordDownloadData>({
    kind: 'validation',
    message: '어인정 단어 허용, 노인정 단어 허용 중 최소 하나는 선택해야 합니다.',
});

/** 다운로드 필터를 적용해 단어 목록과 통계를 하나의 투영으로 만든다. */
export class GetWordDownloadService {
    constructor(private readonly gateway: WordDownloadQueryGateway) {}

    async get(filter: WordDownloadFilter): Promise<Result<WordDownloadData>> {
        if (!filter.includeAcknowledged && !filter.includeNotAcknowledged) {
            return invalidWordClassError();
        }

        const result = await this.gateway.load({
            includeAcknowledged: filter.includeAcknowledged,
            includeNotAcknowledged: filter.includeNotAcknowledged,
            onlyWordChain: filter.onlyWordChain,
        });
        if (!result.ok) return result;

        const deletionWords = new Set(result.value.pendingRequests
            .filter((request) => request.type === 'delete')
            .map((request) => request.word));
        const registeredWords = result.value.registeredWords.filter(({ word }) => (
            !filter.includeDeleted || !deletionWords.has(word)
        ));
        const addedWords = filter.includeAdded
            ? result.value.pendingRequests.filter((request) => request.type === 'add').map((request) => request.word)
            : [];
        const words = [...new Set([...registeredWords.map(({ word }) => word), ...addedWords])]
            .sort((first, second) => first.localeCompare(second, 'ko'));

        return ok({
            words,
            stats: this.buildStats(registeredWords, addedWords, filter.includeDeleted, deletionWords.size),
        });
    }

    private buildStats(
        registeredWords: WordDownloadRegisteredWord[],
        addedWords: string[],
        includesDeleted: boolean,
        deletionCount: number,
    ): WordDownloadData['stats'] {
        return {
            totalCount: new Set([...registeredWords.map(({ word }) => word), ...addedWords]).size,
            acknowledgedCount: registeredWords.filter(({ isNoInjung }) => !isNoInjung).length,
            notAcknowledgedCount: registeredWords.filter(({ isNoInjung }) => isNoInjung).length,
            addedCount: addedWords.length,
            deletedCount: includesDeleted ? deletionCount : 0,
            wordChainCount: registeredWords.filter(({ canUseInWordChain }) => canUseInWordChain).length,
            wordNotChainCount: registeredWords.filter(({ canUseInWordChain }) => !canUseInWordChain).length,
        };
    }
}
