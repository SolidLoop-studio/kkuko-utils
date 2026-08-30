export const docsQueryKeys = {
    all: ['docs'] as const,
    list: ['docs', 'list'] as const,
    logs: (id: number) => ['docs', id, 'logs'] as const,
    info: (id: number) => ['docs', id, 'info'] as const,
    content: (id: number) => ['docs', id, 'content'] as const,
    markers: (id: number) => ['docs', id, 'markers'] as const,
    pendingRequests: ['docs', 'requests', 'pending'] as const,
    letterDuplicate: (docsName: string) => [
        'docs', 'letter', 'duplicate', docsName,
    ] as const,
    isLogsQueryKey: (queryKey: readonly unknown[]) => (
        queryKey.length === 3
        && queryKey[0] === 'docs'
        && typeof queryKey[1] === 'number'
        && queryKey[2] === 'logs'
    ),
};
