import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Provider } from 'react-redux';

jest.mock('../../../modules/word-moderation', () => {
    return {
        useWordApproval: jest.fn(),
    };
});

import AddWordsHome from '../../../app/admin/add-words/AddWordsHome';
import { userReducer } from '../../../app/store/slice';
import {
    useWordApproval,
    type ApprovalProgress,
    type RawWordApprovalEntry,
} from '../../../modules/word-moderation';

const mockUseWordApproval = jest.mocked(useWordApproval);
const mockStart = jest.fn();
const mockResume = jest.fn().mockResolvedValue(undefined);
const mockCancel = jest.fn().mockResolvedValue(undefined);

const completedProgress: ApprovalProgress = {
    stage: 'completed',
    completedEntries: 1,
    totalEntries: 1,
    completedBatches: 1,
    totalBatches: 1,
};

function useMockApprovalWorkflow() {
    const [progress, setProgress] = useState<ApprovalProgress | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    return {
        start: async (entries: RawWordApprovalEntry[]) => {
            setIsProcessing(true);
            mockStart(entries);
            setProgress(completedProgress);
            setIsProcessing(false);
            return {
                ok: true as const,
                value: {
                    operationId: 'operation-1',
                    approvedWordCount: 1,
                    addedThemeCount: 1,
                    removedThemeCount: 0,
                    processedRequestCount: 1,
                    affectedDocsIds: [],
                },
            };
        },
        resume: mockResume,
        cancel: mockCancel,
        pendingJobs: [],
        isPendingJobsLoading: false,
        progress,
        isProcessing,
        error: null,
    };
}

const renderHome = (role: 'guest' | 'admin') => {
    const store = configureStore({
        reducer: { user: userReducer },
        preloadedState: {
            user: {
                username: role === 'admin' ? '관리자' : undefined,
                uuid: role === 'admin' ? 'actor-must-not-enter-command' : undefined,
                role,
            },
        },
    });

    return render(
        <Provider store={store}>
            <AddWordsHome />
        </Provider>,
    );
};

describe('AddWordsHome', () => {
    beforeEach(() => {
        mockUseWordApproval.mockImplementation(useMockApprovalWorkflow);
    });

    it('실제 파일 업로드를 hook command로 연결하고 완료 안내를 표시한다', async () => {
        const user = userEvent.setup();
        renderHome('admin');
        const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

        await user.upload(
            input,
            new File([JSON.stringify({ 나비: ['10'] })], 'words.json', {
                type: 'application/json',
            }),
        );
        await user.click(screen.getByRole('button', { name: '처리 시작' }));

        expect(mockStart).toHaveBeenCalledWith([
            { word: '나비', themeCodes: ['10'] },
        ]);
        await waitFor(() => {
            expect(screen.getByText('처리가 완료되었습니다!')).toBeInTheDocument();
        });
    });

    it('Redux 역할은 UI를 안내하고 command에 actor 정보를 추가하지 않는다', async () => {
        const user = userEvent.setup();
        renderHome('guest');
        const input = screen.getByLabelText(/클릭하여 파일 업로드/) as HTMLInputElement;

        await user.upload(
            input,
            new File([JSON.stringify({ 나비: ['10'] })], 'words.json', {
                type: 'application/json',
            }),
        );

        expect(screen.getByText('관리자 권한이 필요합니다.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '처리 시작' })).toBeDisabled();
        expect(mockStart).not.toHaveBeenCalled();
    });
});
