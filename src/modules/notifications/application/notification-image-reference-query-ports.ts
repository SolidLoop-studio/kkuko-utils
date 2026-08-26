import type { Result } from '@/src/shared/application/result';

export interface NotificationImageReferenceQueryGateway {
    hasReference(imageUrl: string): Promise<Result<boolean>>;
}
