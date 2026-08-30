export const adminDashboardQueryKeys = {
    all: ['admin-dashboard'] as const,
    summary: () => [...adminDashboardQueryKeys.all, 'summary'] as const,
};
