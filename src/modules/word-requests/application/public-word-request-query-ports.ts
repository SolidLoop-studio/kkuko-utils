import type { Result } from '@/src/shared/application/result';
import type {
    PublicWordRequestPageProjection,
    PublicWordRequestQueryInput,
} from './public-word-request-query-types';

/** 공개 단어 요청 페이지를 읽는 Infrastructure 계약입니다. */
export interface PublicWordRequestPageQueryGateway {
    load(input: PublicWordRequestQueryInput): Promise<Result<PublicWordRequestPageProjection>>;
}
