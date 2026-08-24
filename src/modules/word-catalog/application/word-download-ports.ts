import type { Result } from '../../../shared/application/result';
import type { WordDownloadFilter, WordDownloadSource } from './word-download-types';

/** 단어 다운로드에 필요한 등록 단어와 대기 요청을 조회한다. */
export interface WordDownloadQueryGateway {
    load(filter: Pick<WordDownloadFilter,
        'includeAcknowledged' | 'includeNotAcknowledged' | 'onlyWordChain'
    >): Promise<Result<WordDownloadSource>>;
}
