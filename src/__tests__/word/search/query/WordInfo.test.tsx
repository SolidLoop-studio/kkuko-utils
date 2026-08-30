import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';

import WordInfo, {
    type WordInfoProps,
} from '../../../../app/word/search/[query]/WordInfo';
import { useWordThemes } from '../../../../modules/word-catalog';
import { useWordInfoMutations } from '../../../../app/word/search/[query]/use-word-info-mutations';
import { err, ok } from '../../../../shared/application/result';

const routerBack = jest.fn();
const legacyWordThemesReq = jest.fn().mockResolvedValue({ data: [], error: null });
let consoleErrorSpy: jest.SpyInstance;

const expectNoMaximumUpdateDepthError = () => {
    expect(consoleErrorSpy.mock.calls.some(([message]) => (
        typeof message === 'string' && message.includes('Maximum update depth exceeded')
    ))).toBe(false);
};

const flushReactEffects = async () => {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

jest.mock('react-redux', () => ({
    useSelector: jest.fn(),
}));

jest.mock('../../../../modules/word-catalog', () => ({ useWordThemes: jest.fn() }));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ back: routerBack }),
}));

jest.mock('../../../../app/word/search/[query]/use-word-info-mutations', () => ({
    useWordInfoMutations: jest.fn(),
}));

jest.mock('../../../../app/word/search/[query]/SearchBar', () => () => null);
jest.mock('../../../../app/components/Spinner', () => () => <div>loading</div>);
jest.mock('../../../../app/lib/supabaseClient', () => ({
    SCM: {
        add: () => ({
            wordThemesReq: legacyWordThemesReq,
            wordLog: jest.fn().mockResolvedValue({ error: null }),
            docsLog: jest.fn().mockResolvedValue({ error: null }),
            waitWord: jest.fn().mockResolvedValue({
                data: { requested_at: '2026-08-23T00:00:00.000Z' },
                error: null,
            }),
        }),
        delete: () => ({
            wordById: jest.fn().mockResolvedValue({ error: null }),
            waitWordByWord: jest.fn().mockResolvedValue({ error: null }),
        }),
        get: () => ({
            allDocs: jest.fn().mockResolvedValue({ data: [], error: null }),
            wordInfoByWord: jest.fn().mockResolvedValue({
                data: { added_at: '2026-08-20T12:00:00.000Z' },
                error: null,
            }),
        }),
        update: () => ({
            docsLastUpdate: jest.fn().mockResolvedValue({ error: null }),
        }),
    },
}));

jest.mock('../../../../app/components/ui/card', () => ({
    Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

jest.mock('../../../../app/components/ui/button', () => ({
    Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
    ),
}));

jest.mock('../../../../app/components/ui/badge', () => ({
    Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

jest.mock('../../../../app/components/ui/checkbox', () => ({
    Checkbox: ({
        checked,
        onCheckedChange,
        ...props
    }: React.InputHTMLAttributes<HTMLInputElement> & {
        onCheckedChange?: (checked: boolean) => void;
    }) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onCheckedChange?.(event.target.checked)}
            {...props}
        />
    ),
}));

jest.mock('../../../../app/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../../../../app/components/ConfirmModal', () => ({
    __esModule: true,
    default: ({
        title,
        description,
        onConfirm,
    }: {
        title: string;
        description: string;
        onConfirm: () => void;
    }) => (
        <div role="dialog" aria-label="confirmation">
            <p>{title}</p>
            <p>{description}</p>
            <button onClick={onConfirm}>확인</button>
        </div>
    ),
}));

jest.mock('../../../../app/components/CompleteModal', () => ({
    __esModule: true,
    default: ({
        title,
        description,
        onClose,
    }: {
        title: string;
        description: string;
        onClose: () => void;
    }) => (
        <div role="dialog" aria-label="completion">
            <p>{title}</p>
            <p>{description}</p>
            <button onClick={onClose}>완료 닫기</button>
        </div>
    ),
}));

jest.mock('../../../../app/components/ErrModal', () => ({
    __esModule: true,
    default: ({ error }: { error: ErrorMessage }) => (
        <div role="alert">
            {error.ErrName}|{error.ErrMessage}|{error.ErrStackRace}|{error.inputValue}
        </div>
    ),
}));

type UserRole = 'guest' | 'r1' | 'r2' | 'r3' | 'r4' | 'admin';

const requestDeletion = jest.fn();
const cancelRequest = jest.fn();
const requestThemeChanges = jest.fn();
const deleteDirectly = jest.fn();
let isPending = false;
let currentUser: { uuid?: string; role: UserRole } = {
    uuid: 'user-1',
    role: 'r1',
};

const themes = [
    { id: 1, code: 'animal', name: '동물' },
    { id: 2, code: 'place', name: '지명' },
];
let currentThemes = themes;

const createWordInfo = (
    overrides: Partial<WordInfoProps> = {},
): WordInfoProps => ({
    word: '나비',
    missionLetter: [],
    initial: 'ㄴㅂ',
    length: 2,
    topic: { ok: ['지명'], waitAdd: [], waitDel: [] },
    isChainable: true,
    isSeniorApproved: true,
    goFirstLetterWords: 4,
    goLastLetterWords: 7,
    isConnectionLoading: false,
    status: 'ok',
    dbId: 23,
    documents: [],
    requester_uuid: 'owner-1',
    requester: '요청자',
    requestTime: '2026-08-20T12:00:00.000Z',
    goFirstLetterWord: async () => undefined,
    goLastLetterWord: async () => undefined,
    reloadWordInfo: jest.fn(),
    ...overrides,
});

const renderWordInfo = (wordInfo = createWordInfo()) => {
    const view = render(<WordInfo wordInfo={wordInfo} />);
    return { ...view, wordInfo };
};

const confirmPrimaryAction = async () => {
    fireEvent.click(screen.getByRole('button', { name: /삭제요청|요청취소/ }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'completion' })).toBeInTheDocument());
};

beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    isPending = false;
    currentThemes = themes;
    currentUser = { uuid: 'user-1', role: 'r1' };
    jest.mocked(useSelector).mockImplementation((selector) => selector({
        user: currentUser,
    } as never));
    jest.mocked(useWordThemes).mockImplementation(() => ({
        data: currentThemes,
        error: undefined,
        isLoading: false,
    } as unknown as ReturnType<typeof useWordThemes>));
    jest.mocked(useWordInfoMutations).mockImplementation(() => ({
        requestDeletion,
        cancelRequest,
        requestThemeChanges,
        deleteDirectly,
        isPending,
    }));
    requestDeletion.mockResolvedValue(ok({
        requestId: 11,
        word: '나비',
        requestType: 'delete',
    }));
    cancelRequest.mockResolvedValue(ok({
        requestId: 12,
        word: '나비',
        requestType: 'delete',
    }));
    deleteDirectly.mockResolvedValue(ok({
        deletedWordCount: 1,
        affectedDocsIds: [],
    }));
    requestThemeChanges.mockResolvedValue(ok({ word: '나비', changes: [] }));
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});

describe('WordInfo mutations', () => {
    it('shows a safe Korean error when the catalog theme query fails', async () => {
        jest.mocked(useWordThemes).mockReturnValue({
            data: undefined,
            error: { kind: 'infrastructure', message: 'raw SDK diagnostic' },
            isLoading: false,
        } as unknown as ReturnType<typeof useWordThemes>);

        renderWordInfo();

        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('주제 정보를 불러오는 중 오류가 발생했습니다.');
        expect(alert).not.toHaveTextContent('raw SDK diagnostic');
        await flushReactEffects();
        expect(useWordThemes.mock.calls.length).toBeLessThan(5);
        expectNoMaximumUpdateDepthError();
    });

    it('renders connection counts and disables both connections while lookup is pending', () => {
        const wordInfo = createWordInfo();
        const view = renderWordInfo(wordInfo);

        const previousButton = screen.getByRole('button', { name: /\(4\)/ });
        const nextButton = screen.getByRole('button', { name: /\(7\)/ });
        expect(previousButton).toBeEnabled();
        expect(nextButton).toBeEnabled();

        view.rerender(
            <WordInfo
                wordInfo={{
                    ...wordInfo,
                    isConnectionLoading: true,
                }}
            />,
        );

        expect(screen.getByRole('button', { name: /\(4\)/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: /\(7\)/ })).toBeDisabled();
    });

    it('routes an r4 registered-word deletion through a deletion request', async () => {
        currentUser = { uuid: 'r4-user', role: 'r4' };
        renderWordInfo();

        fireEvent.click(screen.getByRole('button', { name: '삭제요청' }));
        expect(screen.getByRole('dialog', { name: 'confirmation' })).toHaveTextContent(
            '요청후 취소 할 수 있습니다.',
        );
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
        await waitFor(() => expect(screen.getByRole('dialog', { name: 'completion' })).toBeInTheDocument());

        expect(requestDeletion).toHaveBeenCalledWith({ word: '나비' });
        expect(deleteDirectly).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'completion' })).toHaveTextContent('삭제 요청을');
    });

    it('routes an admin registered-word deletion through direct deletion', async () => {
        currentUser = { uuid: 'admin-user', role: 'admin' };
        renderWordInfo();

        expect(screen.queryByRole('button', { name: '삭제요청' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        expect(screen.getByRole('dialog', { name: 'confirmation' })).toHaveTextContent(
            '삭제 후 복구할 수 없습니다.',
        );
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
        await waitFor(() => expect(screen.getByRole('dialog', { name: 'completion' })).toBeInTheDocument());

        expect(deleteDirectly).toHaveBeenCalledWith(23);
        expect(requestDeletion).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog', { name: 'completion' })).toHaveTextContent('삭제를');
        expect(screen.getByRole('dialog', { name: 'completion' })).not.toHaveTextContent('삭제 요청을');
    });

    it('cancels a pending delete request owned by the current user', async () => {
        currentUser = { uuid: 'owner-1', role: 'r2' };
        renderWordInfo(createWordInfo({ status: '삭제요청' }));

        await confirmPrimaryAction();

        expect(cancelRequest).toHaveBeenCalledWith({ word: '나비' });
        expect(screen.getByRole('dialog', { name: 'completion' })).toHaveTextContent('삭제 요청 취소를');
    });

    it('returns to the previous screen after closing a canceled add request', async () => {
        currentUser = { uuid: 'owner-1', role: 'r1' };
        const wordInfo = createWordInfo({ status: '추가요청' });
        renderWordInfo(wordInfo);

        await confirmPrimaryAction();
        expect(cancelRequest).toHaveBeenCalledWith({ word: '나비' });
        fireEvent.click(screen.getByRole('button', { name: '완료 닫기' }));

        expect(routerBack).toHaveBeenCalledTimes(1);
        expect(wordInfo.reloadWordInfo).not.toHaveBeenCalled();
    });

    it('maps theme names to codes, uses result DTO names, and leaves topic props unchanged', async () => {
        requestThemeChanges.mockResolvedValue(ok({
            word: '나비',
            changes: [
                { themeCode: 'animal', themeName: '반환 동물', type: 'add' },
                { themeCode: 'place', themeName: '반환 지명', type: 'delete' },
            ],
        }));
        const wordInfo = createWordInfo();
        const originalTopic = JSON.parse(JSON.stringify(wordInfo.topic)) as WordInfoProps['topic'];
        renderWordInfo(wordInfo);

        fireEvent.click(screen.getByRole('button', { name: '수정' }));
        fireEvent.click(screen.getByRole('button', { name: /노인정 주제/ }));
        fireEvent.click(screen.getByLabelText('동물'));
        fireEvent.click(screen.getByLabelText('지명'));
        fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
        fireEvent.click(screen.getByRole('button', { name: '확인' }));

        await waitFor(() => expect(requestThemeChanges).toHaveBeenCalledWith({
            word: '나비',
            changes: [
                { themeCode: 'place', type: 'delete' },
                { themeCode: 'animal', type: 'add' },
            ],
        }));
        const completion = await screen.findByRole('dialog', { name: 'completion' });
        expect(completion).toHaveTextContent('반환 동물');
        expect(completion).toHaveTextContent('반환 지명');
        expect(wordInfo.topic).toEqual(originalTopic);
    });

    it('shows only stable application error fields and no completion modal', async () => {
        requestDeletion.mockResolvedValue(err({
            kind: 'conflict',
            message: '이미 요청된 단어입니다.',
            code: 'WORD_REQUEST_EXISTS',
        }));
        renderWordInfo();

        fireEvent.click(screen.getByRole('button', { name: '삭제요청' }));
        fireEvent.click(screen.getByRole('button', { name: '확인' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'ApplicationError:conflict|이미 요청된 단어입니다.|WORD_REQUEST_EXISTS|delete request',
        );
        expect(screen.queryByRole('dialog', { name: 'completion' })).not.toBeInTheDocument();
    });

    it('disables main controls and prevents theme confirmation while a mutation is pending', async () => {
        const view = renderWordInfo();
        fireEvent.click(screen.getByRole('button', { name: '수정' }));

        isPending = true;
        view.rerender(<WordInfo wordInfo={view.wordInfo} />);

        expect(screen.getByRole('button', { name: '수정' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '삭제요청' })).toBeDisabled();
        const saveButton = screen.getByRole('button', { name: '변경사항 저장' });
        expect(saveButton).toBeDisabled();
        fireEvent.click(saveButton);
        expect(screen.queryByRole('dialog', { name: 'confirmation' })).not.toBeInTheDocument();
    });

    it('reloads the parent projection when a successful non-add-cancel completion closes', async () => {
        const wordInfo = createWordInfo();
        renderWordInfo(wordInfo);

        await confirmPrimaryAction();
        fireEvent.click(screen.getByRole('button', { name: '완료 닫기' }));

        expect(wordInfo.reloadWordInfo).toHaveBeenCalledTimes(1);
        expect(routerBack).not.toHaveBeenCalled();
    });

    it('does not invoke a theme mutation when there are no changes', async () => {
        renderWordInfo();

        fireEvent.click(screen.getByRole('button', { name: '수정' }));
        fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
        fireEvent.click(screen.getByRole('button', { name: '확인' }));

        await waitFor(() => expect(screen.getByRole('dialog', { name: 'completion' })).toBeInTheDocument());
        expect(requestThemeChanges).not.toHaveBeenCalled();
        expect(legacyWordThemesReq).not.toHaveBeenCalled();
    });

    it('shows a safe validation error when a selected theme loses its loaded code', async () => {
        const view = renderWordInfo();
        fireEvent.click(screen.getByRole('button', { name: '수정' }));
        fireEvent.click(screen.getByRole('button', { name: /노인정 주제/ }));
        fireEvent.click(screen.getByLabelText('동물'));

        currentThemes = themes.filter((theme) => theme.code !== 'animal');
        view.rerender(<WordInfo wordInfo={view.wordInfo} />);
        await waitFor(() => expect(screen.getByRole('button', { name: /노인정 주제/ })).toHaveTextContent('/1'));
        fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }));
        fireEvent.click(screen.getByRole('button', { name: '확인' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'ApplicationError:validation|선택한 주제 정보를 확인할 수 없습니다.|UNKNOWN_THEME|theme edit save',
        );
        expect(requestThemeChanges).not.toHaveBeenCalled();
        expect(screen.queryByRole('dialog', { name: 'completion' })).not.toBeInTheDocument();
    });
});
