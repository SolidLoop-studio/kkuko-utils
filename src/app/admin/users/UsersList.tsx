'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Crown, Shield, Star, User, Users } from 'lucide-react';
import { type AdminUserListSort, type AdminUserRole, useAdminUserList } from '@/src/modules/admin-users';
import ErrorModal from '@/src/app/components/ErrModal';
import { Badge } from '@/src/app/components/ui/badge';
import { Button } from '@/src/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/app/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/app/components/ui/table';

type ErrorModalView = {
    ErrName: string;
    ErrMessage: string;
    ErrStackRace: string;
    inputValue: string;
};

const userListError = (): ErrorModalView => ({
    ErrName: '사용자 목록 조회 오류',
    ErrMessage: '사용자 목록을 불러오는 중 오류가 발생했습니다.',
    ErrStackRace: '',
    inputValue: '',
});

const getRoleIcon = (role: AdminUserRole) => {
    switch (role) {
        case 'admin': return <Crown className="w-4 h-4 text-yellow-500" />;
        case 'r4': return <Shield className="w-4 h-4 text-purple-500" />;
        case 'r3': return <Star className="w-4 h-4 text-blue-500" />;
        default: return <User className="w-4 h-4 text-gray-500" />;
    }
};

const getRoleName = (role: AdminUserRole) => {
    switch (role) {
        case 'admin': return '관리자';
        case 'r4': return '베테랑';
        case 'r3': return '활동가';
        case 'r2': return '일반';
        case 'r1': return '새싹';
        default: return '일반';
    }
};

const getRoleBadgeColor = (role: AdminUserRole) => {
    switch (role) {
        case 'admin': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'r4': return 'bg-purple-100 text-purple-800 border-purple-300';
        case 'r3': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'r2': return 'bg-green-100 text-green-800 border-green-300';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
};

const UsersList = () => {
    const router = useRouter();
    const [sort, setSort] = useState<AdminUserListSort>({ field: 'contribution', direction: 'desc' });
    const [isQueryErrorDismissed, setIsQueryErrorDismissed] = useState(false);
    const { data, error, isLoading, refetch } = useAdminUserList(sort);
    const users = data ?? [];

    const handleSort = (field: AdminUserListSort['field']) => {
        setIsQueryErrorDismissed(false);
        setSort((currentSort) => (currentSort.field === field
            ? { field, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' }
            : { field, direction: 'desc' }));
    };

    const handleRetry = () => {
        setIsQueryErrorDismissed(false);
        void refetch();
    };

    const SortButton = ({ field, children }: { field: AdminUserListSort['field']; children: React.ReactNode }) => (
        <Button variant="ghost" className="h-auto p-0 font-medium hover:bg-transparent" onClick={() => handleSort(field)}>
            <span className="flex items-center gap-1">
                {children}
                {sort.field === field
                    ? (sort.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)
                    : <span className="w-4 h-4" />}
            </span>
        </Button>
    );

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
                <div className="max-w-7xl mx-auto flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
                        <p className="text-gray-600 dark:text-gray-300">사용자 목록을 불러오는 중...</p>
                    </div>
                </div>
            </div>
        );
    }

    const totalContribution = users.reduce((sum, user) => sum + user.contribution, 0);
    const queryError = error === null || isQueryErrorDismissed ? null : userListError();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6 transition-colors duration-300">
            <div className="max-w-7xl mx-auto">
                <Link href="/admin" className="mb-4 flex">
                    <Button variant="outline"><ArrowLeft />관리자 대시보드로 이동</Button>
                </Link>

                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">사용자 관리</h1>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300">등록된 사용자들의 정보와 기여도를 관리합니다</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-transparent dark:border-gray-700">
                        <CardContent className="p-6"><div className="flex items-center justify-between"><div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">총 사용자 수</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{users.length}</p>
                        </div><div className="p-3 bg-blue-50 dark:bg-blue-900 rounded-lg"><Users className="w-6 h-6 text-blue-600" /></div></div></CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-transparent dark:border-gray-700">
                        <CardContent className="p-6"><div className="flex items-center justify-between"><div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">관리자 수</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{users.filter((user) => user.role === 'admin').length}</p>
                        </div><div className="p-3 bg-yellow-50 dark:bg-yellow-900 rounded-lg"><Crown className="w-6 h-6 text-yellow-600" /></div></div></CardContent>
                    </Card>
                    <Card className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow border border-transparent dark:border-gray-700">
                        <CardContent className="p-6"><div className="flex items-center justify-between"><div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">총 기여도</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalContribution.toLocaleString()}</p>
                        </div><div className="p-3 bg-green-50 dark:bg-green-900 rounded-lg"><Star className="w-6 h-6 text-green-600" /></div></div></CardContent>
                    </Card>
                </div>

                <Card className="bg-white dark:bg-gray-800 shadow-sm border border-transparent dark:border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">사용자 목록</CardTitle>
                        <CardDescription className="dark:text-gray-300">닉네임을 클릭하면 해당 사용자의 프로필 페이지로 이동합니다. 열 제목을 클릭하여 정렬할 수 있습니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error !== null && <div className="mb-4"><Button variant="outline" aria-label="사용자 목록 다시 시도" onClick={handleRetry}>다시 시도</Button></div>}
                        <div className="rounded-md border border-gray-200 dark:border-gray-700">
                            <Table>
                                <TableHeader><TableRow className="border-gray-200 dark:border-gray-700">
                                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100"><SortButton field="nickname">닉네임</SortButton></TableHead>
                                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">역할</TableHead>
                                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100"><SortButton field="contribution">총 기여도</SortButton></TableHead>
                                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100"><SortButton field="monthContribution">{new Date().getMonth() + 1}월 기여도</SortButton></TableHead>
                                    <TableHead className="font-semibold text-gray-900 dark:text-gray-100">사용자 ID</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>{users.map((user) => (
                                    <TableRow key={user.id} className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                                        <TableCell className="font-medium"><button onClick={() => router.push(`/profile/${user.nickname}`)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors">{user.nickname}</button></TableCell>
                                        <TableCell><Badge variant="outline" className={`flex items-center gap-1 w-fit ${getRoleBadgeColor(user.role)}`}>{getRoleIcon(user.role)}{getRoleName(user.role)}</Badge></TableCell>
                                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">{user.contribution.toLocaleString()}</TableCell>
                                        <TableCell className="font-medium text-gray-900 dark:text-gray-100">{user.monthContribution.toLocaleString()}</TableCell>
                                        <TableCell className="text-gray-600 dark:text-gray-400 font-mono text-sm">{user.id}</TableCell>
                                    </TableRow>
                                ))}</TableBody>
                            </Table>
                        </div>
                        {users.length === 0 && <div className="text-center py-8"><Users className="w-12 h-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-600 dark:text-gray-400">등록된 사용자가 없습니다.</p></div>}
                    </CardContent>
                </Card>
            </div>
            {queryError !== null && <ErrorModal error={queryError} onClose={() => setIsQueryErrorDismissed(true)} />}
        </div>
    );
};

export default UsersList;
