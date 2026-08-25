export const docsQueryKeys = {
    all: ['docs'] as const,
    list: ['docs', 'list'] as const,
    logs: (id: number) => ['docs', id, 'logs'] as const,
    info: (id: number) => ['docs', id, 'info'] as const,
    pendingRequests: ['docs', 'requests', 'pending'] as const,
};
