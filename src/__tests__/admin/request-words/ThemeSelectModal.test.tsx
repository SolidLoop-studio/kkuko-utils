import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactNode } from 'react';

jest.mock('../../../modules/word-catalog', () => ({
    useWordThemes: jest.fn(),
}));

jest.mock('../../../app/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => (
        open ? <div>{children}</div> : null
    ),
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

jest.mock('../../../app/components/ui/button', () => ({
    Button: ({ children, ...props }: ComponentProps<'button'>) => (
        <button {...props}>{children}</button>
    ),
}));

jest.mock('../../../app/components/ui/checkbox', () => ({
    Checkbox: ({
        checked,
        id,
        onCheckedChange,
    }: {
        checked: boolean;
        id: string;
        onCheckedChange: () => void;
    }) => (
        <input
            checked={checked}
            id={id}
            onChange={onCheckedChange}
            type="checkbox"
        />
    ),
}));

jest.mock('../../../app/components/ui/badge', () => ({
    Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

jest.mock('../../../app/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../../app/lib/supabaseClient', () => ({
    SCM: { get: jest.fn(() => ({ allThemes: jest.fn() })) },
}));

import ThemeSelectModal from '../../../app/admin/request-words/ThemeSelectModal';
import { useWordThemes } from '../../../modules/word-catalog';

const useWordThemesMock = jest.mocked(useWordThemes);

const themes = [
    { id: 1, code: '100', name: '하늘' },
    { id: 2, code: '20', name: '가방' },
    { id: 3, code: 'EXT', name: '테스트' },
    { id: 4, code: 'A1', name: '나무' },
];

const renderModal = (overrides: Partial<ComponentProps<typeof ThemeSelectModal>> = {}) => {
    const props: ComponentProps<typeof ThemeSelectModal> = {
        isOpen: true,
        onClose: jest.fn(),
        word: '가나다',
        initialSelectedThemes: [],
        onConfirm: jest.fn(),
        ...overrides,
    };

    return { ...render(<ThemeSelectModal {...props} />), props };
};

describe('ThemeSelectModal', () => {
    beforeEach(() => {
        useWordThemesMock.mockReturnValue({
            data: themes,
            error: null,
            isLoading: false,
        } as ReturnType<typeof useWordThemes>);
    });

    test('uses the catalog query only while the modal is open', () => {
        const { rerender } = renderModal({ isOpen: false });

        expect(useWordThemesMock).toHaveBeenLastCalledWith(false);

        rerender(
            <ThemeSelectModal
                initialSelectedThemes={[]}
                isOpen
                onClose={jest.fn()}
                onConfirm={jest.fn()}
                word="가나다"
            />,
        );

        expect(useWordThemesMock).toHaveBeenLastCalledWith(true);
    });

    test('shows the existing loading UI while the catalog query is pending', () => {
        useWordThemesMock.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true,
        } as ReturnType<typeof useWordThemes>);

        renderModal();

        expect(screen.getByText('주제 목록을 불러오는 중...')).toBeInTheDocument();
    });

    test('shows a stable Korean error instead of a query error', () => {
        useWordThemesMock.mockReturnValue({
            data: undefined,
            error: {
                kind: 'infrastructure',
                message: 'Supabase connection refused',
            },
            isLoading: false,
        } as ReturnType<typeof useWordThemes>);

        renderModal();

        expect(screen.getByText('주제 목록을 불러오는 중 오류가 발생했습니다.')).toBeInTheDocument();
        expect(screen.queryByText('Supabase connection refused')).not.toBeInTheDocument();
    });

    test('groups numeric and non-numeric codes and sorts each group in Korean order', () => {
        renderModal();

        const numericGroup = screen.getByText('노인정 주제').parentElement;
        const nonNumericGroup = screen.getByText('어인정 주제').parentElement;

        expect(numericGroup).toHaveTextContent('가방하늘');
        expect(nonNumericGroup).toHaveTextContent('나무테스트');
        expect(numericGroup?.textContent?.indexOf('가방')).toBeLessThan(
            numericGroup?.textContent?.indexOf('하늘') ?? 0,
        );
        expect(nonNumericGroup?.textContent?.indexOf('나무')).toBeLessThan(
            nonNumericGroup?.textContent?.indexOf('테스트') ?? 0,
        );
    });

    test('keeps request and prior selections, applies changes, and maps summaries to the moderation callback', async () => {
        const user = userEvent.setup();
        const { props } = renderModal({
            initialSelectedThemes: [{ theme_id: 1, theme_name: '하늘', theme_code: '100' }],
            initialSelectedThemeIds: new Set([3]),
        });

        await waitFor(() => expect(screen.getByRole('button', { name: '확인 (2개 선택)' })).toBeEnabled());
        expect(screen.getByLabelText('하늘')).toBeChecked();
        expect(screen.getByLabelText('테스트')).toBeChecked();

        await user.click(screen.getByLabelText('하늘'));
        await user.click(screen.getByLabelText('가방'));
        await user.click(screen.getByRole('button', { name: '확인 (2개 선택)' }));

        expect(props.onConfirm).toHaveBeenCalledWith([
            { theme_id: 2, theme_name: '가방', theme_code: '20' },
            { theme_id: 3, theme_name: '테스트', theme_code: 'EXT' },
        ]);
        expect(props.onClose).toHaveBeenCalledTimes(1);
    });
});
