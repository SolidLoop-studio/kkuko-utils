"use client";
import React, { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/app/components/ui/tabs";
import {
    User,
    Star,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Shield,
    Edit3,
    FileText,
    Plus,
    Trash2,
    Loader2,
} from "lucide-react";
import { ko } from "date-fns/locale";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import ErrorModal from "@/app/components/ErrModal";
import { AppDispatch, RootState } from "@/app/store/store";
import { useDispatch, useSelector } from "react-redux";
import type { PostgrestError } from "@supabase/supabase-js";
import { SCM } from "@/app/lib/supabaseClient";
import { userAction } from "@/app/store/slice";
import CompleteModal from "@/app/components/CompleteModal";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Separator } from "@radix-ui/react-select";
import axios, { isAxiosError } from "axios";
import { Progress } from '@/app/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from "next/link";

type role = "r1" | "r2" | "r3" | "r4" | "admin";
type status = "pending" | "approved" | "rejected";
type ttype = "add" | "delete";

type userInfo = {
    id: string;
    nickname: string;
    contribution: number;
    role: role;
    month_contribution: number;
};

type waitWordList = {
    id: number;
    word: string;
    request_type: ttype;
    requested_at: string;
    status: status;
}[];

type logList = {
    id: number;
    word: string;
    created_at: string;
    state: status;
    r_type: ttype;
}[];

type starredDocsList = {
    id: number;
    name: string;
    last_update: string;
    typez: string;
}[];

// 로딩 중 표시해줄 더미 데이터 목록들
const dummyUser = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    nickname: "dummyUser",
    contribution: 245,
    role: "r3" as role,
    month_contribution: 42,
    month_contribution_rank: 4,
};

const dummyMonthlyData = [
    { month: '2024-08', contribution: 15 },
    { month: '2024-09', contribution: 28 },
    { month: '2024-10', contribution: 35 },
    { month: '2024-11', contribution: 42 },
    { month: '2024-12', contribution: 42 }
];

// 지연로딩에 표시될 스켈레톤 데이터
const TabSkeleton = () => (
    <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
            </div>
        ))}
    </div>
);

const ProfilePage = ({ userName }: { userName: string }) => {
    const [user, setUser] = useState<
        userInfo & { month_contribution_rank: number }
    >(dummyUser);
    const [waitWords, setWaitWords] = useState<waitWordList>([]);
    const [logs, setLogs] = useState<logList>([]);
    const [starredDocs, setStarredDocs] = useState<starredDocsList>([]);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [newNickname, setNewNickname] = useState<string>(user.nickname);
    const [nicknameError, setNicknameError] = useState<string>("");
    const [loading, setLoading] = useState<string | null>("유저 데이터 가져 오는 중...");
    const [errorModalView, seterrorModalView] = useState<ErrorMessage | null>(null);
    const router = useRouter();
    const userReudx = useSelector((state: RootState) => state.user);
    const dispatch = useDispatch<AppDispatch>();
    const [complete, setComplete] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);
    const [monthlyContributions, setMonthlyContributions] = useState<{ month: string, contribution: number }[]>(dummyMonthlyData);
    const [tabsLoading, setTabsLoading] = useState({
        starred: true,
        requests: true,
        processed: true
    });

    // 자신 프로필 인지 체크 (닉네임 변경 ui표시 여부 결정)
    const isOwnProfile = user.id === userReudx.uuid;

    // 오류 처리 함수
    const makeError = (error: PostgrestError) => {
        seterrorModalView({
            ErrName: error.name,
            ErrMessage: error.message,
            ErrStackRace: error.code,
            inputValue: "admin",
        });
        setLoading(null);
    };

    useEffect(() => {
        const getData = async () => {
            // 유저 기본 데이터 가져오기
            const { data: getUserData, error: getUserError } = await SCM.get().userByNickname(userName);
            if (getUserError) {
                return makeError(getUserError);
            }
            if (!getUserData) {
                return makeError({
                    name: "unknown",
                    details: "",
                    code: "EEE1",
                    hint: "",
                    message: "알수 없는 에러",
                });
            }
            // 이번달 기여도 랭킹 가져오기
            const { data: mcrankData, error: mcrankError } = await SCM.get().monthlyConRankByUserId(getUserData.id);
            if (mcrankError) {
                return makeError(mcrankError);
            }
            setNewNickname(getUserData.nickname);
            setUser({ ...getUserData, month_contribution_rank: mcrankData });
            setIsAdmin(getUserData.role === "admin");
            const {data: monthlyContributionsData, error: monthlyContributionsError} = await SCM.get().monthlyContributionsByUserId(getUserData.id);
            if (monthlyContributionsError) return makeError(monthlyContributionsError);

            const now = new Date();

            // 최근 5개월 구하기 (가장 오래된 달부터 정렬)
            const recentMonths = Array.from({ length: 5 }, (_, i) => {
            const date = new Date(now.getFullYear(), now.getMonth() - 4 + i); // 5개월 전부터 현재까지
            return `${date.getFullYear()}-${date.getMonth() + 1}`;
            });

            // DB에서 가져온 기여도 데이터를 Map으로 변환 (month: contribution)
            const contributionMap = new Map(
            monthlyContributionsData.map(({ contribution, month }) => {
                const formattedMonth = `${new Date(month).getFullYear()}-${new Date(month).getMonth() + 1}`;
                return [formattedMonth, contribution];
            })
            );

            // 현재 달 데이터 추가
            contributionMap.set(
                `${now.getFullYear()}-${now.getMonth() + 1}`,
                getUserData.month_contribution
            );

            // 최종 배열 구성 (누락된 달은 0으로 채움)
            const filledContributions = recentMonths.map(month => ({
                month,
                contribution: contributionMap.get(month) ?? 0,
            }));

            setMonthlyContributions(filledContributions);

            setLoading(null);
            await loadTabsData(getUserData.id);
        };
        getData();
        
    }, []);

    // 등급에 따름 이름
    const getRoleName = (role: role) => {
        const roleNames = {
            r1: "새싹",
            r2: "일반",
            r3: "활동가",
            r4: "베테랑",
            admin: "관리자",
        };
        return roleNames[role] || role;
    };

    // 등급에 따른 색깔
    const getRoleColor = (role: role) => {
        const roleColors = {
            r1: "bg-green-100 text-green-800",
            r2: "bg-blue-100 text-blue-800",
            r3: "bg-purple-100 text-purple-800",
            r4: "bg-orange-100 text-orange-800",
            admin: "bg-red-100 text-red-800",
        };
        return roleColors[role] || "bg-gray-100 text-gray-800";
    };

    // 이번달 기여도 랭크 글자의 색깔
    const getRankColor = (rank: number) => {
        if (rank === 0) return "";
        if (rank === 1) return "bg-yellow-400 text-black";
        if (rank === 2) return "bg-gray-300 text-black";
        if (rank === 3) return "bg-orange-400 text-black";
        return "bg-black text-white";
    };

    // tap 부분 데이터 레이지 로딩
    const loadTabsData = async (userId: string) => {
        // 즐겨찾기 문서 로딩
        const loadStarredDocs = async () => {
            try {
                const { data, error } = await SCM.get().starredDocsById(userId);
                
                if (error) throw error;
                
                setStarredDocs(
                    data.map(({ docs: { name, typez, last_update, id } }) => ({
                        name,
                        id,
                        typez,
                        last_update,
                    }))
                );
            } catch (error) {
                console.error('즐겨찾기 문서 로딩 실패:', error);
            } finally {
                setTabsLoading(prev => ({ ...prev, starred: false }));
            }
        };

        // 요청 내역 로딩
        const loadRequests = async () => {
            try {
                const { data, error } = await SCM.get().requestsListById(userId);
                
                if (error) throw error;
                setWaitWords(data);
            } catch (error) {
                console.error('요청 내역 로딩 실패:', error);
            } finally {
                setTabsLoading(prev => ({ ...prev, requests: false }));
            }
        };

        // 처리 내역 로딩
        const loadProcessed = async () => {
            try {
                const { data, error } = await SCM.get().logsListById(userId);
                
                if (error) throw error;
                setLogs(data);
            } catch (error) {
                console.error('처리 내역 로딩 실패:', error);
            } finally {
                setTabsLoading(prev => ({ ...prev, processed: false }));
            }
        };

        // 병렬로 모든 탭 데이터 로딩
        Promise.all([
            loadStarredDocs(),
            loadRequests(),
            loadProcessed()
        ]);
    };

    // 닉네임 업데이트 처리하는 함수
    const updateNickname = async (updateNickname: string) => {
        try {
            // api로 업데이트 요청 날리고 적절하게 반환값 가공
            const res = await axios.post<
                { data: null; error: PostgrestError } | { data: userInfo; error: null }
            >("/api/auth/update_nickname", {
                nickname: updateNickname,
            });
            const { data, error } = res.data;
            return { data, error };
        } catch (error) {
            if (isAxiosError(error)) {
                return {
                    data: null,
                    error: {
                        name: "update fail",
                        details: "",
                        code: "EEE4",
                        hint: "",
                        message: error.message,
                    },
                };
            } else {
                return {
                    data: null,
                    error: {
                        name: "unknown",
                        details: "",
                        code: "EEE4",
                        hint: "",
                        message: "알수 없는 에러",
                    },
                };
            }
        }
    };

    // 요청 / 처리 상태 아이콘
    const getStatusIcon = (status: status) => {
        switch (status) {
            case "pending":
                return <AlertCircle className="h-4 w-4 text-yellow-500" />;
            case "approved":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "rejected":
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return <AlertCircle className="h-4 w-4 text-gray-500" />;
        }
    };

    // 요청 / 처리 상태 텍스트 
    const getStatusText = (status: status) => {
        const statusTexts = {
            pending: "대기중",
            approved: "승인됨",
            rejected: "거절됨",
        };
        return statusTexts[status] || status;
    };

    const getRequestTypeText = (type: ttype) => {
        return type === "add" ? "추가" : "삭제";
    };

    // 해당 시각이 지금부터 몇 시간 전인지 반환 하는 함수 
    const formatTimeAgo = (dateString: string) => {
        return formatDistanceToNow(new Date(dateString), {
            addSuffix: true,
            locale: ko,
        });
    };

    // 닉네임 업데이트 버튼 클릭했을때 처리 하는 함수
    const handleNicknameUpdate = async () => {
        setNicknameError("");

        // 중복 체크 후 중복이면 컷
        if (newNickname.trim() === "") {
            setNicknameError("닉네임을 입력해주세요.");
            return;
        }

        if (newNickname === user.nickname || !userReudx.uuid) {
            setIsEditing(false);
            return;
        }

        setLoading("닉네임 변경 처리중...");
        const { data: existingUser, error: existingUserError } = await SCM.get().usersByNickname(newNickname);

        if (existingUserError) {
            return makeError(existingUserError);
        }
        if (existingUser.length > 0) {
            setNicknameError("이미 존재하는 닉네임 입니다.");
        } else {
            // 존재하는 닉네임이 아니면 업데이트 처리
            const { data: updateNicknameData, error: updateNicknameError } =
                await updateNickname(newNickname);
            if (updateNicknameError) {
                return makeError(updateNicknameError);
            }
            if (!updateNicknameData) {
                return makeError({
                    name: "unknown",
                    details: "",
                    code: "EEE2",
                    hint: "",
                    message: "알수 없는 에러",
                });
            }
            setUser((prev) => ({ ...prev, nickname: updateNicknameData.nickname }));
            dispatch(
                userAction.setInfo({
                    username: updateNicknameData.nickname,
                    role: updateNicknameData.role,
                    uuid: updateNicknameData.id,
                })
            );
            setComplete(
                `${updateNicknameData.nickname}으로 닉네임이 정상적으로 변경되었습니다!`
            );
        }
        setLoading(null);
    };

    const updateUsernickComp = () => {
        setComplete(null);
        setLoading("잠시만 기다려 주세요...");
        router.push(`/profile/${user.nickname}`);
    };

    // 다음 등급까지의 진행도 얻는 함수
    const getRoleProgress = (role: role, contribution: number) => {
        switch (role) {
            case 'r1':
                return {
                    current: contribution,
                    target: 1000,
                    nextRole: 'r2',
                    nextRoleName: '일반',
                    showProgress: true
                };
            case 'r2':
                return {
                    current: contribution,
                    target: 5000,
                    nextRole: 'r3',
                    nextRoleName: '활동가',
                    showProgress: true
                };
            case 'r3':
                return {
                    current: contribution,
                    target: contribution,
                    nextRole: null,
                    nextRoleName: null,
                    showProgress: false,
                    maxLevel: true
                };
            case 'r4':
            case 'admin':
                return {
                    current: contribution,
                    target: contribution,
                    nextRole: null,
                    nextRoleName: null,
                    showProgress: false,
                    adminLevel: true
                };
            default:
                return {
                    current: 0,
                    target: 1000,
                    nextRole: 'r2',
                    nextRoleName: '일반',
                    showProgress: true
                };
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8 max-w-6xl min-h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 프로필 정보 */}
                <div className="lg:col-span-1">
                    <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <CardHeader className="text-center">
                            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                                <User className="h-10 w-10 text-white" />
                            </div>
                            <div className="space-y-2">
                                {isOwnProfile && isEditing ? (
                                    <div className="space-y-2">
                                        <Input
                                            value={newNickname}
                                            onChange={(e) => setNewNickname(e.target.value)}
                                            placeholder="새 닉네임"
                                            className="text-center bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                        />
                                        {nicknameError && (
                                            <p className="text-sm text-red-500">{nicknameError}</p>
                                        )}
                                        <div className="flex gap-2 justify-center">
                                            <Button size="sm" onClick={handleNicknameUpdate}>
                                                저장
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setNewNickname(user.nickname);
                                                    setNicknameError("");
                                                }}
                                            >
                                                취소
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2">
                                        <CardTitle className="text-xl text-gray-900 dark:text-gray-100">{user.nickname}</CardTitle>
                                        {isOwnProfile && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setIsEditing(true)}
                                            >
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                )}
                                <Badge className={getRoleColor(user.role)}>
                                    {getRoleName(user.role)}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                        {user.contribution}
                                    </p>
                                    <p className="text-sm text-muted-foreground dark:text-gray-400">총 기여도</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                                        {user.month_contribution}
                                    </p>
                                    <p className="text-sm text-muted-foreground dark:text-gray-400">이달 기여도</p>
                                    {user.month_contribution_rank !== 0 && (
                                        <Badge
                                            className={getRankColor(user.month_contribution_rank)}
                                        >
                                            {`${user.month_contribution_rank}등`}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* 등급 진행률 */}
                            {(() => {
                                const progress = getRoleProgress(user.role, user.contribution);
                                if (progress.showProgress) {
                                    const progressPercentage = Math.min((progress.current / progress.target) * 100, 100);
                                    return (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-muted-foreground dark:text-gray-400">
                                                    다음 등급까지
                                                </span>
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                    {progress.current} / {progress.target}
                                                </span>
                                            </div>
                                            <Progress value={progressPercentage} className="h-2" />
                                            <p className="text-xs text-center text-muted-foreground dark:text-gray-400">
                                                {progress.nextRoleName} 등급까지 {progress.target - progress.current}점 남음
                                            </p>
                                        </div>
                                    );
                                } else if (progress.maxLevel) {
                                    return (
                                        <div className="text-center py-3">
                                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                                🎉 최고등급 달성!
                                            </p>
                                        </div>
                                    );
                                } else if (progress.adminLevel) {
                                    return (
                                        <div className="text-center py-3">
                                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                                👑 관리자 등급입니다
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* 월간 기여도 그래프 */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground dark:text-gray-400">최근 5개월 기여도</h3>
                                <div className="h-32">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={monthlyContributions}>
                                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                            <XAxis
                                                dataKey="month"
                                                tick={{ fontSize: 10, fill: "#6b7280" }}
                                                tickFormatter={(value) => {
                                                    const date = new Date(value + '-01');
                                                    return `${date.getMonth() + 1}월`;
                                                }}
                                            />
                                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                                            <Tooltip
                                                labelFormatter={(value) => {
                                                    const date = new Date(value + '-01');
                                                    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
                                                }}
                                                formatter={(value) => [`${value}개`, '기여도']}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="contribution"
                                                stroke="#3b82f6"
                                                strokeWidth={2}
                                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                                                activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* 관리자이면 관리자 홈으로 이동 가능하게 */}
                            {isAdmin && isOwnProfile && (
                                <Link href={'/admin'}>
                                    <Button
                                        className="w-full"
                                        variant="outline"
                                    >
                                        <Shield className="h-4 w-4 mr-2" />
                                        관리자 대시보드
                                    </Button>
                                </Link>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* 활동 내역 */}
                <div className="lg:col-span-2">
                    <Tabs defaultValue="starred" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="starred">즐겨찾기</TabsTrigger>
                            <TabsTrigger value="requests">요청 내역</TabsTrigger>
                            <TabsTrigger value="processed">처리 내역</TabsTrigger>
                        </TabsList>

                        {/* 즐겨찾기한 문서들 */}
                        <TabsContent value="starred">
                            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                        <Star className="h-5 w-5 text-yellow-500" />
                                        즐겨찾기한 문서
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        {tabsLoading.starred ? <TabSkeleton /> :
                                            (
                                            <div className="p-4">
                                                {starredDocs.length === 0 ? (
                                                    <p className="text-center text-muted-foreground dark:text-gray-400 py-8">
                                                        즐겨찾기한 문서가 없습니다.
                                                    </p>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {starredDocs.map((doc, index) => (
                                                            <Link href={`/words-docs/${doc.id}`} key={doc.id}>
                                                                <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                                                                    <div className="flex items-center gap-3">
                                                                        <FileText className="h-4 w-4 text-blue-500" />
                                                                        <div>
                                                                            <p className="font-medium text-gray-900 dark:text-gray-100">{doc.name}</p>
                                                                            <p className="text-sm text-muted-foreground dark:text-gray-400">
                                                                                {formatTimeAgo(doc.last_update)}에
                                                                                업데이트
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <Badge variant="outline">{doc.typez}</Badge>
                                                                </div>
                                                                {index < starredDocs.length - 1 && (
                                                                    <Separator className="my-2" />
                                                                )}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            )
                                        }
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* 요청 내역 */}
                        <TabsContent value="requests">
                            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                        <Clock className="h-5 w-5 text-blue-500" />
                                        단어 요청 내역
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        {tabsLoading.requests ? <TabSkeleton /> : (<div className="p-4">
                                            {waitWords.length === 0 ? (
                                                <p className="text-center text-muted-foreground dark:text-gray-400 py-8">
                                                    요청 내역이 없습니다.
                                                </p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {waitWords.map((item, index) => (
                                                        <div key={item.id}>
                                                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    {item.request_type === "add" ? (
                                                                        <Plus className="h-4 w-4 text-green-500" />
                                                                    ) : (
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    )}
                                                                    <div>
                                                                        <p className="font-medium text-gray-900 dark:text-gray-100">{item.word}</p>
                                                                        <p className="text-sm text-muted-foreground dark:text-gray-400">
                                                                            {getRequestTypeText(item.request_type)}{" "}
                                                                            요청 • {formatTimeAgo(item.requested_at)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {getStatusIcon(item.status)}
                                                                    <span className="text-sm text-gray-900 dark:text-gray-100">
                                                                        {getStatusText(item.status)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {index < waitWords.length - 1 && (
                                                                <Separator className="my-2" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>)}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        {/* 처리 내역 */}
                        <TabsContent value="processed">
                            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                        처리된 요청
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[400px]">
                                        {tabsLoading.processed ? <TabSkeleton /> : (<div className="p-4">
                                            {logs.length === 0 ? (
                                                <p className="text-center text-muted-foreground dark:text-gray-400 py-8">
                                                    처리된 요청이 없습니다.
                                                </p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {logs.map((log, index) => (
                                                        <div key={log.id}>
                                                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                                                <div className="flex items-center gap-3">
                                                                    {log.r_type === "add" ? (
                                                                        <Plus className="h-4 w-4 text-green-500" />
                                                                    ) : (
                                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                                    )}
                                                                    <div>
                                                                        <p className="font-medium text-gray-900 dark:text-gray-100">{log.word}</p>
                                                                        <p className="text-sm text-muted-foreground dark:text-gray-400">
                                                                            {getRequestTypeText(log.r_type)} •{" "}
                                                                            {formatTimeAgo(log.created_at)}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {getStatusIcon(log.state)}
                                                                    <span className="text-sm text-gray-900 dark:text-gray-100">
                                                                        {getStatusText(log.state)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {index < logs.length - 1 && (
                                                                <Separator className="my-2" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>)}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
            {/* 로딩 오버레이 */}
            {loading && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                    <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                            <span className="text-slate-700 dark:text-slate-300">
                                {loading}
                            </span>
                        </div>
                    </Card>
                </div>
            )}

            {/* 오류 모달 */}
            {errorModalView && (
                <ErrorModal
                    error={errorModalView}
                    onClose={() => seterrorModalView(null)}
                />
            )}

            {/* 닉네임 변경 완료 모달 */}
            {complete && (
                <CompleteModal
                    open={complete !== null}
                    onClose={updateUsernickComp}
                    title={"닉네임 변경 완료"}
                    description={complete}
                />
            )}
        </div>
    </div>
    );
};

export default ProfilePage;
