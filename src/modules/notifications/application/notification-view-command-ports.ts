import type { Result } from '@/src/shared/application/result';

export interface NotificationViewCommandGateway {
    record(id: number): Promise<Result<number>>;
}
