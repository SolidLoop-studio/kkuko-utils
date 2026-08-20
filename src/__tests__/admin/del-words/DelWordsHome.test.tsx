import { render, screen } from '@testing-library/react';

jest.mock('../../../modules/word-moderation', () => ({
    useWordDeletion: jest.fn(() => ({
        start: jest.fn(),
        resume: jest.fn(),
        cancel: jest.fn(),
        clearError: jest.fn(),
        pendingJobs: [],
        progress: null,
        result: null,
        error: null,
        isPending: false,
    })),
}));

import DelWordsHome from '../../../app/admin/del-words/DelWordsHome';

describe('DelWordsHome', () => {
    it('기존 제목, 설명, 관리자 복귀 링크를 유지한다', () => {
        render(<DelWordsHome />);

        expect(screen.getByRole('heading', { name: '단어 대량 삭제 페이지' })).toBeInTheDocument();
        expect(screen.getByText('단어를 대량으로 삭제합니다.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /관리자 대시보드로 이동/ })).toHaveAttribute('href', '/admin');
    });

    it('source boundary does not reference SCM or Supabase query APIs', () => {
        const source = require('fs').readFileSync(
            require('path').resolve(process.cwd(), 'src/app/admin/del-words/DelWordsHome.tsx'),
            'utf8',
        );
        for (const forbidden of ['SCM', '@supabase/supabase-js', '.rpc(', '.from(']) {
            expect(source).not.toContain(forbidden);
        }
    });
});
