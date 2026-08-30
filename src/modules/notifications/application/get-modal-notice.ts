import type { Result } from '@/src/shared/application/result';
import type { ModalNoticeQueryGateway } from './modal-notice-query-ports';
import type { ModalNotice } from './notification-list-query-types';

/** 현재 노출할 최신 활성 모달 공지를 조회합니다. */
export class GetModalNoticeService {
    constructor(private readonly gateway: ModalNoticeQueryGateway) {}

    get(): Promise<Result<ModalNotice | null>> {
        return this.gateway.loadActive();
    }
}
