import type { User } from '@/src/modules/admin-api-server';

export type UserInput = Pick<User, 'isPublic' | 'isLastOnlineHidden'>;
export type { User };
