import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NotificationDetailProjection } from '@/src/modules/notifications';
import { useSaveNotification } from '@/src/modules/notifications';
import type { ApplicationError } from '@/src/shared/application/application-error';
import { err, ok, type Result } from '@/src/shared/application/result';
import type { NotificationWriteResult } from '@/src/modules/notifications';

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockUseSelector = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

jest.mock('react-redux', () => ({
    useSelector: (selector: unknown) => mockUseSelector(selector),
}));

jest.mock('../../modules/notifications', () => ({
    useSaveNotification: jest.fn(),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('lucide-react', () => ({
    AlertCircle: () => <span />,
    Check: () => <span />,
    CheckCircle: () => <span />,
    ChevronDown: () => <span />,
    ChevronLeft: () => <span />,
    ChevronUp: () => <span />,
    Copy: () => <span />,
    Loader2: () => <span />,
    Upload: () => <span />,
    X: () => <span />,
}));

jest.mock('../../app/components/MarkdownViewer', () => ({
    __esModule: true,
    default: ({ content }: { content: string }) => <p>{content}</p>,
}));

jest.unmock('../../app/components/ErrModal');

import NotificationWriteForm from '@/src/app/notification/components/NotificationWriteForm';
import NotificationWrite from '@/src/app/notification/write/NotificationWrite';

const notification: NotificationDetailProjection = {
    id: 17,
    title: '점검 안내',
    body: '점검 본문',
    imageUrl: 'https://example.com/notice.png',
    createdAt: '2026-08-27T01:00:00.000Z',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: true,
    views: 40,
};

const getFileInput = (container: HTMLElement): HTMLInputElement => {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('file input not found');
    return input;
};

const getForm = (): HTMLFormElement => {
    const form = screen.getByRole('button', { name: /(등록|수정)하기/ }).closest('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('notification form not found');
    return form;
};

const fillCreateFields = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('제목'), '새 공지');
    await user.type(
        screen.getByPlaceholderText('공지 내용을 입력하세요 (Markdown 문법 지원)'),
        '새 공지 본문',
    );
};

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
};

describe('NotificationWriteForm', () => {
    const mockSaveNotification = jest.fn<Promise<Result<NotificationWriteResult>>, [unknown]>();
    const mockOnError = jest.fn<void, [ApplicationError]>();

    beforeEach(() => {
        mockSaveNotification.mockResolvedValue(ok({ id: 17, imageUrl: null }));
        jest.mocked(useSaveNotification).mockReturnValue({
            saveNotification: mockSaveNotification,
            isPending: false,
        });
        jest.mocked(URL.createObjectURL).mockReturnValue('blob:notification-preview');
        mockUseSelector.mockReturnValue({ role: 'admin' });
    });

    it('initializes every existing edit field and remote image preview', () => {
        render(<NotificationWriteForm notification={notification} />);

        expect(screen.getByLabelText('제목')).toHaveValue('점검 안내');
        expect(screen.getByLabelText('게시 종료일')).toHaveValue('2026-08-30');
        expect(screen.getByLabelText('중요 공지 (상단 고정)')).toBeChecked();
        expect(screen.getByLabelText('팝업 공지')).toBeChecked();
        expect(screen.getByPlaceholderText('공지 내용을 입력하세요 (Markdown 문법 지원)'))
            .toHaveValue('점검 본문');
        expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
            'src',
            'https://example.com/notice.png',
        );
    });

    it('creates a component-owned preview without saving or uploading when a file is selected', async () => {
        const user = userEvent.setup();
        const file = new File(['preview'], 'notice.png', { type: 'image/png' });
        const { container } = render(<NotificationWriteForm onError={mockOnError} />);

        await user.upload(getFileInput(container), file);

        expect(URL.createObjectURL).toHaveBeenCalledWith(file);
        expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
            'src',
            'blob:notification-preview',
        );
        expect(screen.getByText('notice.png')).toBeInTheDocument();
        expect(mockSaveNotification).not.toHaveBeenCalled();
        expect(mockOnError).not.toHaveBeenCalled();
    });

    it('submits create with a replace command and converts a blank non-modal end date to now', async () => {
        const user = userEvent.setup();
        const file = new File(['image'], 'notice.png', { type: 'image/png' });
        const now = Date.parse('2026-08-27T03:04:05.000Z');
        jest.spyOn(Date, 'now').mockReturnValue(now);
        const { container } = render(<NotificationWriteForm onError={mockOnError} />);
        await fillCreateFields(user);
        await user.upload(getFileInput(container), file);

        await user.click(screen.getByRole('button', { name: '등록하기' }));

        await waitFor(() => expect(mockSaveNotification).toHaveBeenCalledWith({
            mode: 'create',
            title: '새 공지',
            body: '새 공지 본문',
            endsAt: '2026-08-27T03:04:05.000Z',
            isImportant: false,
            isModal: false,
            imageChange: { kind: 'replace', file },
        }));
    });

    it('submits an unchanged edit image with the original expected URL and converted chosen date', async () => {
        const user = userEvent.setup();
        render(<NotificationWriteForm notification={notification} onError={mockOnError} />);

        await user.click(screen.getByRole('button', { name: '수정하기' }));

        await waitFor(() => expect(mockSaveNotification).toHaveBeenCalledWith({
            mode: 'update',
            id: 17,
            expectedImageUrl: 'https://example.com/notice.png',
            title: '점검 안내',
            body: '점검 본문',
            endsAt: '2026-08-30T00:00:00.000Z',
            isImportant: true,
            isModal: true,
            imageChange: { kind: 'keep' },
        }));
    });

    it('submits removal of the existing edit image explicitly without revoking its remote URL', async () => {
        const user = userEvent.setup();
        render(<NotificationWriteForm notification={notification} onError={mockOnError} />);

        await user.click(screen.getByRole('button', { name: '이미지 제거' }));
        expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: '수정하기' }));

        await waitFor(() => expect(mockSaveNotification).toHaveBeenCalledWith({
            mode: 'update',
            id: 17,
            expectedImageUrl: 'https://example.com/notice.png',
            title: '점검 안내',
            body: '점검 본문',
            endsAt: '2026-08-30T00:00:00.000Z',
            isImportant: true,
            isModal: true,
            imageChange: { kind: 'remove' },
        }));
    });

    it('replaces an edit image with the latest file and revokes only the superseded local preview', async () => {
        const user = userEvent.setup();
        const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
        const secondFile = new File(['second'], 'second.png', { type: 'image/png' });
        jest.mocked(URL.createObjectURL)
            .mockReturnValueOnce('blob:first-preview')
            .mockReturnValueOnce('blob:second-preview');
        const { container } = render(
            <NotificationWriteForm notification={notification} onError={mockOnError} />,
        );
        const fileInput = getFileInput(container);

        await user.upload(fileInput, firstFile);
        expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(notification.imageUrl);
        await user.upload(fileInput, secondFile);

        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first-preview');
        expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
            'src',
            'blob:second-preview',
        );
        await user.click(screen.getByRole('button', { name: '수정하기' }));
        await waitFor(() => expect(mockSaveNotification).toHaveBeenCalledWith({
            mode: 'update',
            id: 17,
            expectedImageUrl: 'https://example.com/notice.png',
            title: '점검 안내',
            body: '점검 본문',
            endsAt: '2026-08-30T00:00:00.000Z',
            isImportant: true,
            isModal: true,
            imageChange: { kind: 'replace', file: secondFile },
        }));
    });

    it('revokes the owned preview once when changed edit props restore a new remote image', async () => {
        const user = userEvent.setup();
        const file = new File(['local'], 'local.png', { type: 'image/png' });
        const nextNotification: NotificationDetailProjection = {
            ...notification,
            id: 18,
            imageUrl: 'https://example.com/next-notice.png',
        };
        const rendered = render(<NotificationWriteForm notification={notification} />);

        await user.upload(getFileInput(rendered.container), file);
        rendered.rerender(<NotificationWriteForm notification={nextNotification} />);

        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:notification-preview');
        expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(notification.imageUrl);
        expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(nextNotification.imageUrl);
        expect(screen.getByRole('img', { name: 'Preview' })).toHaveAttribute(
            'src',
            nextNotification.imageUrl,
        );
    });

    it('revokes an active local preview once when it is removed without revoking the remote image', async () => {
        const user = userEvent.setup();
        const file = new File(['local'], 'local.png', { type: 'image/png' });
        const rendered = render(<NotificationWriteForm notification={notification} />);

        await user.upload(getFileInput(rendered.container), file);
        await user.click(screen.getByRole('button', { name: '이미지 제거' }));

        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:notification-preview');
        expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(notification.imageUrl);
        expect(screen.queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument();
    });

    it('revokes the active component-owned preview on unmount but never revokes a remote preview', async () => {
        const user = userEvent.setup();
        const file = new File(['image'], 'notice.png', { type: 'image/png' });
        const rendered = render(<NotificationWriteForm notification={notification} />);

        rendered.unmount();
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();

        const selected = render(<NotificationWriteForm />);
        await user.upload(getFileInput(selected.container), file);
        selected.unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:notification-preview');
    });

    it.each([
        {
            name: 'blank title',
            prepare: () => {
                fireEvent.change(screen.getByLabelText('제목'), { target: { value: '   ' } });
                fireEvent.change(
                    screen.getByPlaceholderText('공지 내용을 입력하세요 (Markdown 문법 지원)'),
                    { target: { value: '본문' } },
                );
            },
            error: {
                kind: 'validation',
                field: 'title',
                message: '공지사항 제목을 입력해주세요.',
            },
        },
        {
            name: 'blank body',
            prepare: () => {
                fireEvent.change(screen.getByLabelText('제목'), { target: { value: '제목' } });
                fireEvent.change(
                    screen.getByPlaceholderText('공지 내용을 입력하세요 (Markdown 문법 지원)'),
                    { target: { value: '   ' } },
                );
            },
            error: {
                kind: 'validation',
                field: 'body',
                message: '공지사항 내용을 입력해주세요.',
            },
        },
        {
            name: 'missing modal end date',
            prepare: () => {
                fireEvent.change(screen.getByLabelText('제목'), { target: { value: '제목' } });
                fireEvent.change(
                    screen.getByPlaceholderText('공지 내용을 입력하세요 (Markdown 문법 지원)'),
                    { target: { value: '본문' } },
                );
                fireEvent.click(screen.getByLabelText('팝업 공지'));
            },
            error: {
                kind: 'validation',
                field: 'endsAt',
                message: '올바른 공지사항 종료일이 필요합니다.',
            },
        },
    ])('reports a stable validation error for $name without saving', ({ prepare, error }) => {
        render(<NotificationWriteForm onError={mockOnError} />);
        prepare();

        fireEvent.submit(getForm());

        expect(mockOnError).toHaveBeenCalledWith(error);
        expect(mockSaveNotification).not.toHaveBeenCalled();
        expect(screen.queryByText('공지사항이 등록되었습니다.')).not.toBeInTheDocument();
    });

    it('forwards a stable service ApplicationError and never shows completion', async () => {
        const user = userEvent.setup();
        const failure: ApplicationError = {
            kind: 'conflict',
            code: 'NOTIFICATION_STALE_IMAGE',
            message: '공지사항이 다른 곳에서 수정되었습니다. 새로고침 후 다시 시도해주세요.',
        };
        mockSaveNotification.mockResolvedValue(err(failure));
        render(<NotificationWriteForm onError={mockOnError} />);
        await fillCreateFields(user);

        await user.click(screen.getByRole('button', { name: '등록하기' }));

        await waitFor(() => expect(mockOnError).toHaveBeenCalledWith(failure));
        expect(screen.queryByText('공지사항이 등록되었습니다.')).not.toBeInTheDocument();
    });

    it.each([
        {
            mode: 'create',
            props: {},
            submitName: '등록하기',
            completion: '공지사항이 등록되었습니다.',
            route: '/notification',
        },
        {
            mode: 'edit',
            props: { notification },
            submitName: '수정하기',
            completion: '공지사항이 수정되었습니다.',
            route: '/notification/17',
        },
    ])('shows the current $mode completion copy and navigates after close', async ({
        props,
        submitName,
        completion,
        route,
    }) => {
        const user = userEvent.setup();
        render(<NotificationWriteForm {...props} />);
        if (!('notification' in props)) await fillCreateFields(user);

        await user.click(screen.getByRole('button', { name: submitName }));

        expect(await screen.findByText(completion)).toBeInTheDocument();
        expect(mockPush).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: '확인' }));
        expect(mockPush).toHaveBeenCalledWith(route);
        expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it('keeps Markdown preview behavior', async () => {
        const user = userEvent.setup();
        render(<NotificationWriteForm />);
        await user.type(
            screen.getByPlaceholderText('공지 내용을 입력하세요 (Markdown 문법 지원)'),
            '**미리보기**',
        );

        await user.click(screen.getByRole('tab', { name: '미리보기' }));

        expect(screen.getByText('**미리보기**')).toBeInTheDocument();
    });

    it('disables submit and every file action while the save hook is pending', () => {
        jest.mocked(useSaveNotification).mockReturnValue({
            saveNotification: mockSaveNotification,
            isPending: true,
        });
        const { container } = render(<NotificationWriteForm notification={notification} />);

        expect(screen.getByRole('button', { name: '이미지 선택' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '이미지 제거' })).toBeDisabled();
        expect(getFileInput(container)).toBeDisabled();
        expect(screen.getByRole('button', { name: '수정하기' })).toBeDisabled();
    });

    it('guards duplicate submits while the first save is unresolved', async () => {
        const deferred = createDeferred<Result<NotificationWriteResult>>();
        mockSaveNotification.mockReturnValue(deferred.promise);
        render(<NotificationWriteForm notification={notification} onError={mockOnError} />);

        fireEvent.submit(getForm());
        fireEvent.submit(getForm());

        expect(mockSaveNotification).toHaveBeenCalledTimes(1);
        deferred.resolve(ok({ id: 17, imageUrl: notification.imageUrl }));
        await screen.findByText('공지사항이 수정되었습니다.');
    });
});

describe('NotificationWrite', () => {
    const mockSaveNotification = jest.fn<Promise<Result<NotificationWriteResult>>, [unknown]>();

    beforeEach(() => {
        mockUseSelector.mockReturnValue({ role: 'admin' });
        mockSaveNotification.mockResolvedValue(ok({ id: 17, imageUrl: null }));
        jest.mocked(useSaveNotification).mockReturnValue({
            saveNotification: mockSaveNotification,
            isPending: false,
        });
    });

    it('preserves the administrator gate and notification return route', () => {
        mockUseSelector.mockReturnValue({ role: 'r1' });
        render(<NotificationWrite />);

        expect(screen.getByText('접근 권한이 없습니다.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: '돌아가기' })).toHaveAttribute('href', '/notification');
        expect(screen.queryByRole('heading', { name: '공지사항 작성' })).not.toBeInTheDocument();
    });

    it('maps ApplicationError to a stable ErrorModal without code, cause, or database details', async () => {
        const user = userEvent.setup();
        const failure: ApplicationError = {
            kind: 'infrastructure',
            code: 'PRIVATE_DATABASE_CODE',
            message: '공지사항 저장에 실패했습니다.',
            cause: new Error('private PostgREST details'),
        };
        mockSaveNotification.mockResolvedValue(err(failure));
        render(<NotificationWrite />);
        await fillCreateFields(user);

        await user.click(screen.getByRole('button', { name: '등록하기' }));

        expect(await screen.findByText('공지사항 저장에 실패했습니다.')).toBeInTheDocument();
        expect(screen.getByText('Notification Error')).toBeInTheDocument();
        expect(screen.queryByText('PRIVATE_DATABASE_CODE')).not.toBeInTheDocument();
        expect(screen.queryByText('private PostgREST details')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: '상세 오류 정보 보기' }));
        expect(screen.getByText('스택 트레이스:')).toBeInTheDocument();
        expect(screen.getAllByText('없음')).toHaveLength(2);
        expect(screen.queryByText('PRIVATE_DATABASE_CODE')).not.toBeInTheDocument();
        expect(screen.queryByText('private PostgREST details')).not.toBeInTheDocument();
    });
});
