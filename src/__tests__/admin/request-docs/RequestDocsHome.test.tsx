import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../../app/components/ui/card');
jest.unmock('../../../app/components/ui/button');
jest.unmock('../../../app/components/ui/checkbox');
jest.unmock('../../../app/components/ui/table');
jest.unmock('../../../app/components/ui/pagination');
jest.unmock('../../../app/components/ErrModal');

const mockDocs = jest.fn();
const mockWaitDocsByIds = jest.fn();

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: {
        add: () => ({ docs: mockDocs }),
        delete: () => ({ waitDocsByIds: mockWaitDocsByIds }),
    },
}));

import DocsWaitManager from '../../../app/admin/request-docs/RequestDocsHome';

const requests = [
    {
        id: 11,
        req_at: '2026-08-22T00:00:00.000Z',
        docs_name: '가',
        req_by: '신청자 A',
        initial_consonant: false,
        req_byId: '00000000-0000-0000-0000-000000000011',
    },
    {
        id: 22,
        req_at: '2026-08-22T00:01:00.000Z',
        docs_name: '나',
        req_by: '신청자 B',
        initial_consonant: false,
        req_byId: null,
    },
];

const createDeferred = <T,>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });

    return { promise, resolve };
};

describe('DocsWaitManager legacy request moderation behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDocs.mockResolvedValue({ error: null });
        mockWaitDocsByIds.mockResolvedValue({ error: null });
    });

    const renderManager = () => render(<DocsWaitManager initialData={requests} />);

    it('선택한 요청과 두음 설정으로 docs를 승인하고 성공 후 행을 제거한다', async () => {
        const user = userEvent.setup();
        const docsDeferred = createDeferred<{ error: null }>();
        const deleteDeferred = createDeferred<{ error: null }>();
        mockDocs.mockReturnValue(docsDeferred.promise);
        mockWaitDocsByIds.mockReturnValue(deleteDeferred.promise);
        renderManager();

        const selection = screen.getByRole('checkbox', { name: '가 선택' });
        await user.click(selection);
        await user.click(document.getElementById('initial-consonant-11')!);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockDocs).toHaveBeenCalledWith([{
            name: '가',
            maker: '00000000-0000-0000-0000-000000000011',
            duem: true,
            typez: 'letter',
        }]);
        expect(screen.getByText('가', { selector: 'td' })).toBeInTheDocument();

        docsDeferred.resolve({ error: null });
        await waitFor(() => expect(mockWaitDocsByIds).toHaveBeenCalledWith([11]));
        expect(screen.getByText('가', { selector: 'td' })).toBeInTheDocument();

        deleteDeferred.resolve({ error: null });
        expect(mockWaitDocsByIds).toHaveBeenCalledWith([11]);
        await waitFor(() => expect(screen.queryByText('가', { selector: 'td' })).not.toBeInTheDocument());
        expect(selection).not.toBeInTheDocument();
    });

    it('docs 생성 실패 시 요청 삭제와 화면 정리를 수행하지 않는다', async () => {
        const user = userEvent.setup();
        mockDocs.mockResolvedValue({ error: { name: 'PostgrestError', message: 'insert failed', code: '23505' } });
        renderManager();

        const selection = screen.getByRole('checkbox', { name: '가 선택' });
        await user.click(selection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        expect(mockWaitDocsByIds).not.toHaveBeenCalled();
        expect(selection).toBeChecked();
        expect(screen.getByText('insert failed')).toBeInTheDocument();
        expect(screen.getByText('가', { selector: 'td' })).toBeInTheDocument();
    });

    it('요청 삭제 실패 시 선택과 행을 유지한다', async () => {
        const user = userEvent.setup();
        mockWaitDocsByIds.mockResolvedValue({ error: { name: 'PostgrestError', message: 'delete failed', code: '23505' } });
        renderManager();

        const selection = screen.getByRole('checkbox', { name: '가 선택' });
        await user.click(selection);
        await user.click(screen.getByRole('button', { name: '선택 승인' }));

        await waitFor(() => expect(screen.getByText('delete failed')).toBeInTheDocument());
        expect(selection).toBeChecked();
        expect(screen.getByText('가', { selector: 'td' })).toBeInTheDocument();
    });

    it('선택한 요청을 반려하고 성공 후 행을 제거한다', async () => {
        const user = userEvent.setup();
        renderManager();

        await user.click(screen.getByRole('checkbox', { name: '나 선택' }));
        await user.click(screen.getByRole('button', { name: '선택 거절' }));

        expect(mockWaitDocsByIds).toHaveBeenCalledWith([22]);
        await waitFor(() => expect(screen.queryByText('나', { selector: 'td' })).not.toBeInTheDocument());
    });
});
