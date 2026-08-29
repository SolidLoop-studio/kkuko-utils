import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('../../modules/release-notes', () => ({ useReleaseNotes: jest.fn() }));
jest.mock('../../app/components/MarkdownViewer', () => (
    ({ content }: { content: string }) => <div>{content}</div>
));
jest.mock('../../app/components/ErrModal', () => (
    ({ error, onClose }: { error: ErrorMessage; onClose: () => void }) => (
        <div data-testid="error-modal">
            {error.ErrName}
            {error.ErrMessage}
            <button type="button" onClick={onClose}>오류 닫기</button>
        </div>
    )
));

import { useReleaseNotes } from '@/src/modules/release-notes';
import ReleaseNote from '@/src/app/release-note/ReleaseNote';

const mockUseReleaseNotes = useReleaseNotes as jest.MockedFunction<typeof useReleaseNotes>;

const internal = [{
    id: 1,
    title: '내부 업데이트',
    content: '내부 상세 내용',
    createdAt: '2026-08-30T01:00:00.000Z',
    link: 'https://example.com/internal',
}];
const github = [{
    id: 2,
    name: '',
    body: '',
    publishedAt: '2026-08-30T02:00:00.000Z',
    htmlUrl: 'https://github.com/SolidLoop-studio/kkuko-utils/releases/tag/v2',
    tagName: 'v2',
}];

const query = (overrides: Record<string, unknown> = {}) => ({
    data: [],
    error: null,
    isPending: false,
    ...overrides,
});

const mockQueries = (
    internalOverrides: Record<string, unknown> = {},
    githubOverrides: Record<string, unknown> = {},
) => {
    mockUseReleaseNotes.mockReturnValue({
        internal: query(internalOverrides),
        github: query(githubOverrides),
    } as unknown as ReturnType<typeof useReleaseNotes>);
};

describe('ReleaseNote', () => {
    test('preserves the full-page loading state until both independent queries settle', () => {
        // Break caught: flashing empty content while either original source request is pending.
        mockQueries({ isPending: false }, { isPending: true });

        render(<ReleaseNote />);

        expect(screen.getByText('데이터를 불러오는 중...')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: '릴리즈 노트' })).not.toBeInTheDocument();
    });

    test('shows both empty states on their existing tabs', async () => {
        // Break caught: removing either source-specific empty state during the hook migration.
        const user = userEvent.setup();
        mockQueries();
        render(<ReleaseNote />);

        expect(screen.getByText('릴리즈 노트가 없습니다.')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'GitHub Releases' }));
        expect(screen.getByText('GitHub 릴리즈가 없습니다.')).toBeInTheDocument();
    });

    test('keeps GitHub releases usable when the internal source fails', async () => {
        // Break caught: an internal failure suppressing the independently successful GitHub result.
        const user = userEvent.setup();
        mockQueries({
            error: { kind: 'infrastructure', message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.' },
        }, { data: github });
        render(<ReleaseNote />);

        expect(screen.getByTestId('error-modal')).toHaveTextContent('릴리즈 노트를 불러오는 중 오류가 발생했습니다.');
        expect(screen.getByTestId('error-modal')).toHaveTextContent('릴리즈 노트 오류');
        expect(screen.queryByText(/private|PostgREST|Supabase/)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'GitHub Releases' }));
        expect(screen.getByRole('heading', { name: 'v2' })).toBeInTheDocument();
    });

    test('preserves dismissing the internal error modal', async () => {
        // Break caught: making the migrated error modal impossible to dismiss.
        const user = userEvent.setup();
        mockQueries({
            error: { kind: 'infrastructure', message: '릴리즈 노트를 불러오는 중 오류가 발생했습니다.' },
        });
        render(<ReleaseNote />);

        await user.click(screen.getByRole('button', { name: '오류 닫기' }));
        expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();
    });

    test('keeps internal notes usable and shows the stable GitHub error on its tab', async () => {
        // Break caught: a GitHub failure suppressing internal results or exposing HTTP details.
        const user = userEvent.setup();
        mockQueries({ data: internal }, {
            error: { kind: 'infrastructure', message: 'GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.' },
        });
        render(<ReleaseNote />);

        expect(screen.getByRole('heading', { name: '내부 업데이트' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'GitHub Releases' }));
        expect(screen.getByText('GitHub 릴리즈를 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText(/HTTP|private/)).not.toBeInTheDocument();
    });

    test('preserves internal and GitHub expansion behavior and fallback text', async () => {
        // Break caught: losing click-to-expand, links, markdown fallback, or reset-on-tab-change.
        const user = userEvent.setup();
        mockQueries({ data: internal }, { data: github });
        render(<ReleaseNote />);

        expect(screen.queryByText('내부 상세 내용')).not.toBeInTheDocument();
        await user.click(screen.getByRole('heading', { name: '내부 업데이트' }));
        expect(screen.getByText('내부 상세 내용')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /https:\/\/example.com\/internal/ })).toHaveAttribute(
            'href',
            'https://example.com/internal',
        );

        await user.click(screen.getByRole('button', { name: 'GitHub Releases' }));
        expect(screen.queryByText('릴리즈 설명이 없습니다.')).not.toBeInTheDocument();
        await user.click(screen.getByRole('heading', { name: 'v2' }));
        expect(screen.getByText('릴리즈 설명이 없습니다.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /GitHub에서 보기/ })).toHaveAttribute(
            'href',
            github[0].htmlUrl,
        );
    });
});
