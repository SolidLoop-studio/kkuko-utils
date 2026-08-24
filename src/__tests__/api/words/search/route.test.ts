import type { NextRequest } from 'next/server';

jest.mock('next/server', () => ({
    NextResponse: {
        json: (value: unknown, init?: { status?: number }) => ({
            status: init?.status ?? 200,
            json: async () => value,
        }),
    },
}));

jest.mock(
    '../../../../modules/word-catalog/infrastructure/server/server-word-catalog-services',
    () => ({ createServerWordCatalogServices: jest.fn() }),
);

import { GET } from '../../../../app/api/words/search/route';

const mockCreateServerWordCatalogServices = jest.requireMock(
    '../../../../modules/word-catalog/infrastructure/server/server-word-catalog-services',
) as { createServerWordCatalogServices: jest.Mock };
const mockSearch = jest.fn();

const createRequest = (search: string): NextRequest => (
    { url: `https://kkuko.example/api/words/search?${search}` } as NextRequest
);

describe('GET /api/words/search', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreateServerWordCatalogServices.createServerWordCatalogServices.mockResolvedValue({
            searchWordsService: { search: mockSearch },
        });
        mockSearch.mockResolvedValue({
            ok: true,
            value: [{ word: '가나다', nextWordCount: 7 }],
        });
    });

    it('maps a populated kor-start request to an advanced word search and returns its results', async () => {
        const response = await GET(createRequest(
            'mode=kor-start&q=%20%EA%B0%80%20&start=%20%EB%82%98%20&mission=%20%EB%8B%A4%20'
            + '&minLength=3&maxLength=7&sortBy=attack&duem=false&miniInfo=true&manner=jen&ingjung=false&limit=25&themeId=99',
        ));

        expect(mockSearch).toHaveBeenCalledWith({
            type: 'advanced',
            query: {
                mode: 'kor-start',
                start: '가',
                end: '나',
                mission: '다',
                isAcceptedOnly: false,
                isManner: false,
                isJen: true,
                isEtiquette: false,
                isDuemApplied: false,
                hasMiniInfo: true,
                minimumLength: 3,
                maximumLength: 7,
                sortOrder: 'attack',
                limit: 25,
            },
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual([{ word: '가나다', nextWordCount: 7 }]);
    });

    it('returns the existing start-letter validation message without calling the service', async () => {
        const response = await GET(createRequest('mode=kor-start'));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: '시작 초성이 필요합니다.' });
        expect(mockSearch).not.toHaveBeenCalled();
    });

    it('returns the existing start-letter validation message for whitespace-only input', async () => {
        mockSearch.mockResolvedValue({
            ok: false,
            error: { kind: 'validation', field: 'start', message: '시작 글자가 필요합니다.' },
        });

        const response = await GET(createRequest('mode=kor-start&q=%20%20%20'));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: '시작 초성이 필요합니다.' });
        expect(mockSearch).not.toHaveBeenCalled();
    });

    it('returns an application infrastructure error as a stable 500 error response', async () => {
        mockSearch.mockResolvedValue({
            ok: false,
            error: { kind: 'infrastructure', message: '단어 조회에 실패했습니다.' },
        });

        const response = await GET(createRequest('mode=kor-start&q=%EA%B0%80'));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: '단어 조회에 실패했습니다.' });
    });

    it('returns the existing invalid-mode validation message', async () => {
        const response = await GET(createRequest('mode=invalid&q=%EA%B0%80'));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: '유효하지 않은 모드입니다.' });
        expect(mockSearch).not.toHaveBeenCalled();
    });
});
