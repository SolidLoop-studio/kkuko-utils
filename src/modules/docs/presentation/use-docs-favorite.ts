'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, type Result } from '@/src/shared/application/result';
import type { SetDocsFavoriteCommand } from '../application/docs-favorite-command-ports';
import type { SetDocsFavoriteService } from '../application/set-docs-favorite';
import { createBrowserDocsServices } from '../infrastructure/browser/browser-docs-services';

export type DocsFavoriteCommandService = Pick<SetDocsFavoriteService, 'set'>;

const infrastructureError = (): ApplicationError => ({
    kind: 'infrastructure',
    message: '문서 즐겨찾기 설정에 실패했습니다. 잠시 후 다시 시도해주세요.',
});

/** 문서 즐겨찾기 희망 상태 command와 화면의 진행 상태를 연결합니다. */
export const useDocsFavorite = (): {
    setFavorite(command: SetDocsFavoriteCommand): Promise<Result<void>>;
    isPending: boolean;
} => {
    const [service] = useState<DocsFavoriteCommandService>(() => (
        createBrowserDocsServices().docsFavoriteCommandService
    ));
    const mutation = useMutation<Result<void>, never, SetDocsFavoriteCommand>({
        mutationFn: async (command) => {
            try {
                return await service.set(command);
            } catch {
                return err(infrastructureError());
            }
        },
    });

    return {
        setFavorite: (command) => mutation.mutateAsync(command),
        isPending: mutation.isPending,
    };
};
