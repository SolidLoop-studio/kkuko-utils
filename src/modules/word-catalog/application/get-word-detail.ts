import { err, ok, type Result } from '../../../shared/application/result';
import type { WordDetailQueryGateway } from './word-detail-ports';
import type { FindRandomConnectedWordInput, WordDetail } from './word-detail-types';

/** 단어 상세 조회 입력을 검증하고 word-catalog 조회 port를 호출한다. */
export class GetWordDetailService {
    constructor(private readonly gateway: WordDetailQueryGateway) {}

    async get(word: string): Promise<Result<WordDetail>> {
        const normalizedWord = word.trim();
        if (!normalizedWord) {
            return err({ kind: 'validation', field: 'word', message: '단어가 필요합니다.' });
        }

        const result = await this.gateway.findDetail(normalizedWord);
        if (!result.ok) return result;
        return result.value === null
            ? err({ kind: 'not-found', code: 'WORD_NOT_FOUND', message: '단어 정보를 찾을 수 없습니다.' })
            : ok(result.value);
    }

    findRandomConnectedWord(input: FindRandomConnectedWordInput): Promise<Result<string | null>> {
        const letters = input.letters.map((letter) => letter.trim()).filter(Boolean);
        return letters.length === 0
            ? Promise.resolve(err({ kind: 'validation', field: 'letters', message: '연결 글자가 필요합니다.' }))
            : this.gateway.findRandomConnectedWord({ ...input, letters });
    }
}
