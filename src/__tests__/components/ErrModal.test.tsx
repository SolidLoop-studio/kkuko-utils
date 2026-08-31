import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.unmock('../../app/components/ErrModal');

import ErrorModal from '@/src/app/components/ErrModal';

const error: ErrorMessage = {
    ErrName: 'FileReaderError',
    ErrMessage: '파일을 읽지 못했습니다.',
    ErrStackRace: 'Error: 파일을 읽지 못했습니다.\n    at FileReader.read',
    HTTPStatus: 500,
    HTTPData: 'internal response',
    inputValue: 'uploaded-words.txt',
};

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve;
    });
    return { promise, resolve };
};

describe('ErrorModal', () => {
    const originalFetch = globalThis.fetch;
    const originalUserAgent = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

    beforeEach(() => {
        window.history.pushState({}, '', '/manager-tool/arrange');
        Object.defineProperty(window.navigator, 'userAgent', {
            configurable: true,
            value: 'Kkuko Test Browser',
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        if (originalUserAgent === undefined) {
            Reflect.deleteProperty(window.navigator, 'userAgent');
        } else {
            Object.defineProperty(window.navigator, 'userAgent', originalUserAgent);
        }
        jest.restoreAllMocks();
    });

    it('reports the displayed error using the application error API contract', async () => {
        const user = userEvent.setup();
        const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
        globalThis.fetch = fetchMock;
        render(<ErrorModal error={error} onClose={jest.fn()} />);

        await user.click(screen.getByRole('button', { name: '오류 신고' }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
            'https://api.solidloop-studio.xyz/api/v1/app-error-report',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: '파일을 읽지 못했습니다.',
                    stack: 'Error: 파일을 읽지 못했습니다.\n    at FileReader.read',
                    errorCode: 'FileReaderError',
                    severity: 'ERROR',
                    url: '/manager-tool/arrange',
                    component: 'ErrModal',
                    browser: 'Kkuko Test Browser',
                }),
            },
        ));
        expect(await screen.findByText('오류가 전송되었습니다.')).toBeInTheDocument();
    });

    it('shows an accessible failure message and allows retry when reporting fails', async () => {
        const user = userEvent.setup();
        globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
        render(<ErrorModal error={error} onClose={jest.fn()} />);

        await user.click(screen.getByRole('button', { name: '오류 신고' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            '오류 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
        );
        expect(screen.getByRole('button', { name: '오류 신고' })).toBeEnabled();
    });

    it('prevents duplicate reports while the first request is pending', async () => {
        const deferred = createDeferred<{ ok: boolean; status: number }>();
        const fetchMock = jest.fn().mockReturnValue(deferred.promise);
        globalThis.fetch = fetchMock;
        render(<ErrorModal error={error} onClose={jest.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: '오류 신고' }));

        const reportingButton = screen.getByRole('button', { name: '전송 중...' });
        expect(reportingButton).toBeDisabled();
        expect(reportingButton).toHaveAttribute('aria-busy', 'true');
        fireEvent.click(reportingButton);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        deferred.resolve({ ok: true, status: 201 });
        expect(await screen.findByText('오류가 전송되었습니다.')).toBeInTheDocument();
    });
});
