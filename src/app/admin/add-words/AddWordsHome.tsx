'use client';

import { useSelector } from 'react-redux';

import { useWordApproval } from '@/src/modules/word-moderation';
import type { RootState } from '@/src/app/store/store';

import WordApprovalPanel from './WordApprovalPanel';

export default function AddWordsHome() {
    const approval = useWordApproval();
    const role = useSelector((state: RootState) => state.user.role);

    return (
        <WordApprovalPanel
            onStart={approval.start}
            onResume={approval.resume}
            onCancel={approval.cancel}
            approvalState={{
                pendingJobs: approval.pendingJobs,
                progress: approval.progress,
                isProcessing: approval.isProcessing,
                error: approval.error,
            }}
            canManage={role === 'admin'}
        />
    );
}
