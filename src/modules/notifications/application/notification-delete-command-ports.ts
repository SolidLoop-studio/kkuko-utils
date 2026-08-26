import type { Result } from '@/src/shared/application/result';

export interface NotificationDeleteCommandGateway {
    deleteById(id: number): Promise<Result<void>>;
}
