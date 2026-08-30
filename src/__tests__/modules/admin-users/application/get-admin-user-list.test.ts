import { GetAdminUserListService } from '@/src/modules/admin-users/application/get-admin-user-list';
import type { AdminUserListQueryGateway } from '@/src/modules/admin-users/application/admin-user-list-ports';
import type {
    AdminUserListItem,
    AdminUserListSort,
} from '@/src/modules/admin-users/application/admin-user-list-types';
import { err, ok, type Result } from '@/src/shared/application/result';

const stableInfrastructureError = err({
    kind: 'infrastructure' as const,
    message: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
});

const validationError = err({
    kind: 'validation' as const,
    message: '올바른 사용자 목록 정렬 조건이 필요합니다.',
});

const contributionSort: AdminUserListSort = {
    field: 'contribution',
    direction: 'desc',
};

const projection: AdminUserListItem[] = [{
    id: 'user-1',
    nickname: '끝말잇기',
    role: 'admin',
    contribution: 1200,
    monthContribution: 34,
}];

const createGateway = (
    result: Result<AdminUserListItem[]> = ok(projection),
): jest.Mocked<AdminUserListQueryGateway> => ({
    loadList: jest.fn().mockResolvedValue(result),
});

describe('GetAdminUserListService', () => {
    test('returns the validated narrow projection for a supported sort', async () => {
        // Break caught: losing an allowed sort or leaking the browser row shape past Application.
        const gateway = createGateway();

        await expect(new GetAdminUserListService(gateway).get(contributionSort)).resolves.toEqual(ok(projection));
        expect(gateway.loadList).toHaveBeenCalledWith(contributionSort);
    });

    test.each([
        { field: 'month_contribution', direction: 'desc' },
        { field: 'contribution', direction: 'up' },
        { field: 'role', direction: 'asc' },
    ])('rejects an invalid sort before calling Infrastructure', async (sort) => {
        // Break caught: passing an unrecognized UI sort through to a database column adapter.
        const gateway = createGateway();

        await expect(new GetAdminUserListService(gateway).get(sort as AdminUserListSort)).resolves.toEqual(validationError);
        expect(gateway.loadList).not.toHaveBeenCalled();
    });

    test('rejects a null sort before calling Infrastructure', async () => {
        // Break caught: crashing on an untyped external sort input instead of returning the Application validation error.
        const gateway = createGateway();

        await expect(new GetAdminUserListService(gateway).get(null as unknown as AdminUserListSort)).resolves.toEqual(validationError);
        expect(gateway.loadList).not.toHaveBeenCalled();
    });

    test('rejects a sort object with extra own properties before calling Infrastructure', async () => {
        // Break caught: accepting an input shape wider than the exact Application sort contract.
        const gateway = createGateway();
        const sort = { ...contributionSort, unexpected: true };

        await expect(new GetAdminUserListService(gateway).get(sort as AdminUserListSort)).resolves.toEqual(validationError);
        expect(gateway.loadList).not.toHaveBeenCalled();
    });

    const malformedProjectionCases: Array<[unknown[]]> = [
        [[{ ...projection[0], role: 'owner' }]],
        [[{ ...projection[0], monthContribution: -1 }]],
        [[{ ...projection[0], nickname: '' }]],
        [[{ ...projection[0], id: '   ' }]],
        [[{ ...projection[0], nickname: '\t' }]],
        [[{ ...projection[0], extra: 'database field' }]],
    ];

    test.each(malformedProjectionCases)('rejects a malformed returned projection', async (items) => {
        // Break caught: rendering an unvalidated or database-coupled item returned by a gateway.
        const gateway = createGateway(ok(items as AdminUserListItem[]));

        await expect(new GetAdminUserListService(gateway).get(contributionSort)).resolves.toEqual(stableInfrastructureError);
    });

    test.each([
        ['a returned gateway failure', createGateway(err({ kind: 'forbidden', message: 'private policy detail' }))],
        ['a thrown gateway failure', { loadList: jest.fn().mockRejectedValue(new Error('private database detail')) }],
    ])('maps %s to one stable public error', async (_description, gateway) => {
        // Break caught: exposing lower-layer diagnostics or raw exceptions to Presentation.
        await expect(new GetAdminUserListService(gateway).get(contributionSort)).resolves.toEqual(stableInfrastructureError);
    });
});
