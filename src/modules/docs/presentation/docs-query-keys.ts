export const docsQueryKeys = {
    all: ['docs'] as const,
    list: ['docs', 'list'] as const,
    logs: (id: number) => ['docs', id, 'logs'] as const,
    pendingRequests: ['docs', 'requests', 'pending'] as const,
};
