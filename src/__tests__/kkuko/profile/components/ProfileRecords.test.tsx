import React from 'react';
import { render, screen } from '@testing-library/react';
import ProfileRecords from '@/src/app/kkuko/profile/components/ProfileRecords';
import { Mode } from '@/src/app/types/kkuko.types';

// Mock helper functions
jest.mock('@/app/kkuko/profile/utils/profileHelper', () => ({
  groupRecordsByMode: jest.fn(() => ({
    kor: [
      { id: '1', modeId: 'kr_word', total: 10, win: 5, exp: 100 },
    ],
    eng: [],
  })),
  getModeName: jest.fn(() => '한국어 끝말잇기'),
  calculateWinRate: jest.fn(() => '50.0'),
}));

describe('ProfileRecords', () => {
    const mockModesData: Mode[] = [
        { modeId: 'kr_word', modeName: '한국어 끝말잇기', group: 'kor' },
    ];
    const mockProfileData: any = {
        record: [
            { id: '1', modeId: 'kr_word', total: 10, win: 5, exp: 100 },
        ],
    };

    it('should render records correctly', () => {
        render(<ProfileRecords profileData={mockProfileData} modesData={mockModesData} />);

        expect(screen.getByText('전적')).toBeInTheDocument();
        expect(screen.getByText('한국어')).toBeInTheDocument();
        expect(screen.getByText('한국어 끝말잇기')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument(); // total
        expect(screen.getByText('5')).toBeInTheDocument(); // win
        expect(screen.getByText('50.0%')).toBeInTheDocument(); // rate
        expect(screen.getByText('100')).toBeInTheDocument(); // exp
    });
});
