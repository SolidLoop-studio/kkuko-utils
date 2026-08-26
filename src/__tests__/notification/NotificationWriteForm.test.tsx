import { render, screen } from '@testing-library/react';
import type { NotificationDetailProjection } from '@/src/modules/notifications';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

jest.mock('lucide-react', () => ({
    ChevronLeft: () => <span />,
    Loader2: () => <span />,
    Upload: () => <span />,
    X: () => <span />,
}));

jest.mock('../../app/components/MarkdownViewer', () => ({
    __esModule: true,
    default: ({ content }: { content: string }) => <p>{content}</p>,
}));

jest.mock('../../app/lib/supabaseClient', () => ({
    SCM: {
        add: () => ({ notification: jest.fn() }),
        update: () => ({ notification: jest.fn() }),
        uploadImage: jest.fn(),
        getPublicUrl: jest.fn(),
    },
}));

import NotificationWriteForm from '@/src/app/notification/components/NotificationWriteForm';

const notification: NotificationDetailProjection = {
    id: 17,
    title: '점검 안내',
    body: '점검 본문',
    imageUrl: 'https://example.com/notice.png',
    createdAt: '2026-08-27T01:00:00.000Z',
    endsAt: '2026-08-30T00:00:00.000Z',
    isImportant: true,
    isModal: true,
};

describe('NotificationWriteForm edit initial values', () => {
    it('initializes the existing edit form from the application projection', () => {
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
});
