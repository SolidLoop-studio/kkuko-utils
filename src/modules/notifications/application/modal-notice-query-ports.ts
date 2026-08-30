import type { Result } from '@/src/shared/application/result';
import type { ModalNotice } from './notification-list-query-types';

export interface ModalNoticeQueryGateway {
    loadActive(): Promise<Result<ModalNotice | null>>;
}
