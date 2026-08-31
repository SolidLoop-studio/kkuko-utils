'use client';

import type { AppErrorLog } from '@/src/modules/admin-api-server';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/src/app/components/ui/dialog';

interface AppLogDetailModalProps {
    log: AppErrorLog | null;
    onClose: () => void;
}

const fields: Array<{ key: keyof AppErrorLog; label: string }> = [
    { key: 'createdAt', label: '발생 시각' },
    { key: 'severity', label: '심각도' },
    { key: 'message', label: '메시지' },
    { key: 'errorCode', label: '오류 코드' },
    { key: 'url', label: 'URL' },
    { key: 'component', label: '컴포넌트' },
    { key: 'browser', label: '브라우저' },
    { key: 'os', label: '운영체제' },
    { key: 'userId', label: '사용자 ID' },
    { key: 'ipAddress', label: 'IP 주소' },
];

export default function AppLogDetailModal({ log, onClose }: AppLogDetailModalProps) {
    return (
        <Dialog open={log !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto bg-white dark:bg-gray-900">
                <DialogHeader>
                    <DialogTitle>애플리케이션 로그 상세</DialogTitle>
                    <DialogDescription>오류가 보고될 때 함께 수집된 진단 정보입니다.</DialogDescription>
                </DialogHeader>
                {log && (
                    <div className="space-y-4 text-sm">
                        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {fields.map(({ key, label }) => (
                                <div key={key} className={key === 'message' ? 'sm:col-span-2' : undefined}>
                                    <dt className="font-medium text-gray-500 dark:text-gray-400">{label}</dt>
                                    <dd className="mt-1 break-words text-gray-900 dark:text-gray-100">
                                        {log[key] ?? '—'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                        <div>
                            <h3 className="font-medium text-gray-500 dark:text-gray-400">스택 트레이스</h3>
                            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-gray-950 p-4 text-xs text-gray-100">
                                {log.stack ?? '스택 트레이스가 없습니다.'}
                            </pre>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
