import { render, screen } from '@testing-library/react';
import KkukoHome from '@/src/app/kkuko/KkukoHome'; // Adjust import path if needed

describe('KkukoHome', () => {
    it('should render the title and description', () => {
        render(<KkukoHome />);

        expect(screen.getByText('끄코 정보')).toBeInTheDocument();
        expect(screen.getByText('끄투코리아의 유저정보와 랭킹을 조회 할 수 있습니다.')).toBeInTheDocument();
    });

    it('should render the Profile section with link', () => {
        render(<KkukoHome />);

        expect(screen.getByRole('heading', { name: '프로필' })).toBeInTheDocument();
        expect(screen.getByText('끄투코리아의 유저 정보와 전적 등을 확인할 수 있습니다.')).toBeInTheDocument();
        
        const profileLink = screen.getByRole('link', { name: /둘러보기/i });
        expect(profileLink).toHaveAttribute('href', '/kkuko/profile');
    });

    it('should render the Ranking section with link', () => {
        render(<KkukoHome />);

        expect(screen.getByRole('heading', { name: '랭킹' })).toBeInTheDocument();
        expect(screen.getByText('각 모드별로 승리가 많은 유저들의 랭킹을 확인할 수 있습니다.')).toBeInTheDocument();
        
        const rankingLink = screen.getByRole('link', { name: /구경하기/i });
        expect(rankingLink).toHaveAttribute('href', '/kkuko/ranking?mode=ALL');
    });
});
