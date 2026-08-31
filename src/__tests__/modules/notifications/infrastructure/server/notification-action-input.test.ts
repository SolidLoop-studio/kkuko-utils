import { parseSaveNotificationFormData } from '@/src/modules/notifications/infrastructure/server/notification-action-input';

const makeFormData = (values: Record<string, string | File> = {}): FormData => {
    const formData = new FormData();
    const defaults: Record<string, string> = {
        mode: 'create',
        expectedImageUrl: '',
        title: '점검 안내',
        body: '점검 본문',
        endsAt: '2026-08-31T00:00:00.000Z',
        isImportant: 'false',
        isModal: 'true',
        imageChange: 'keep',
    };

    for (const [key, value] of Object.entries({ ...defaults, ...values })) {
        formData.append(key, value);
    }
    return formData;
};

describe('parseSaveNotificationFormData', () => {
    it('parses a create command with a replacement image', () => {
        const image = new File(['image'], 'notice.png', { type: 'image/png' });

        expect(parseSaveNotificationFormData(makeFormData({ imageChange: 'replace', image }))).toEqual({
            ok: true,
            value: {
                mode: 'create',
                title: '점검 안내',
                body: '점검 본문',
                endsAt: '2026-08-31T00:00:00.000Z',
                isImportant: false,
                isModal: true,
                imageChange: { kind: 'replace', file: image },
            },
        });
    });

    it.each([
        ['keep', { kind: 'keep' }],
        ['remove', { kind: 'remove' }],
    ] as const)('parses an update command with %s image change', (imageChange, expectedImageChange) => {
        expect(parseSaveNotificationFormData(makeFormData({
            mode: 'update',
            id: '17',
            expectedImageUrl: '',
            imageChange,
        }))).toEqual({
            ok: true,
            value: {
                mode: 'update',
                id: 17,
                expectedImageUrl: null,
                title: '점검 안내',
                body: '점검 본문',
                endsAt: '2026-08-31T00:00:00.000Z',
                isImportant: false,
                isModal: true,
                imageChange: expectedImageChange,
            },
        });
    });

    it('accepts an empty inactive file input for a keep command', () => {
        const emptyFile = new File([], '', { type: 'application/octet-stream' });

        expect(parseSaveNotificationFormData(makeFormData({ image: emptyFile }))).toEqual({
            ok: true,
            value: expect.objectContaining({ imageChange: { kind: 'keep' } }),
        });
    });

    it('parses an update command with its optimistic image URL and replacement file', () => {
        const image = new File(['image'], 'notice.webp', { type: 'image/webp' });

        expect(parseSaveNotificationFormData(makeFormData({
            mode: 'update',
            id: '17',
            expectedImageUrl: 'https://example.com/notice.png',
            imageChange: 'replace',
            image,
        }))).toEqual({
            ok: true,
            value: expect.objectContaining({
                mode: 'update',
                id: 17,
                expectedImageUrl: 'https://example.com/notice.png',
                imageChange: { kind: 'replace', file: image },
            }),
        });
    });

    it.each([
        ['duplicate scalar', () => {
            const data = makeFormData();
            data.append('title', 'duplicate');
            return data;
        }],
        ['noncanonical ID', () => makeFormData({ mode: 'update', id: '017' })],
        ['nonpositive ID', () => makeFormData({ mode: 'update', id: '0' })],
        ['nonboolean checkbox', () => makeFormData({ isImportant: 'on' })],
        ['invalid ISO date', () => makeFormData({ endsAt: '2026-08-31' })],
        ['invalid expected image URL', () => makeFormData({ mode: 'update', id: '17', expectedImageUrl: '/notice.png' })],
        ['create remove image change', () => makeFormData({ imageChange: 'remove' })],
        ['nonempty image without replacement', () => makeFormData({ image: new File(['image'], 'notice.png', { type: 'image/png' }) })],
        ['empty replacement image', () => makeFormData({ imageChange: 'replace', image: new File([], 'notice.png', { type: 'image/png' }) })],
        ['nonimage replacement MIME', () => makeFormData({ imageChange: 'replace', image: new File(['image'], 'notice.txt', { type: 'text/plain' }) })],
        ['oversized replacement image', () => makeFormData({ imageChange: 'replace', image: new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'notice.png', { type: 'image/png' }) })],
    ])('rejects %s', (_label, createFormData) => {
        expect(parseSaveNotificationFormData(createFormData())).toEqual(expect.objectContaining({ ok: false }));
    });
});
