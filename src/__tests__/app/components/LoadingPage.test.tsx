import { render, screen } from '@testing-library/react';

import LoadingPage from '@/src/app/components/LoadingPage';

const renderLoadingPage = () => render(<LoadingPage title="문서 로그" />);

describe('LoadingPage', () => {
    it('단일 작업을 실제 진행률 없이 블러 오버레이로 표시한다', () => {
        renderLoadingPage();

        const loadingStatus = screen.getByRole('status', { name: '문서 로그 로딩 중...' });
        expect(loadingStatus).toHaveClass('fixed', 'inset-0', 'backdrop-blur-sm');
        expect(screen.queryByText(/% 완료/)).not.toBeInTheDocument();
    });
});
