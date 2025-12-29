"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { userAction } from "../store/slice";
import { Suspense } from 'react';
import { LogIn, UserPlus, Loader2, User, AlertCircle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import ErrorModal from '../components/ErrModal';
import type { ErrorMessage } from "@/types/type";
import { SCM } from "@/lib/supabaseClient";

const AuthPage = () => {
    const router = useRouter();
    const [nickname, setNickname] = useState<string>("");
    const [isNewUser, setIsNewUser] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [nicknameError, setNicknameError] = useState("");
    const dispatch = useDispatch<AppDispatch>();
    const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);

    useEffect(() => {
        
        const checkUser = async (session: Session | null) => {
            if (!session) {
                setLoading(false);
                return;
            }

            const { data, error: err } = await SCM.get().userById(session.user.id);
    
            if (err) {
                setErrorModalView({
                    ErrName: err.name ?? null,
                    ErrMessage: err.message ?? null,
                    ErrStackRace: err.stack ?? null,
                    inputValue: null
                });
                return;
            }
    
            if (!data) {
                setIsNewUser(true);
                setLoading(false);
            } else {
                dispatch(
                    userAction.setInfo({
                        username: data.nickname,
                        role: data.role ?? "guest",
                    })
                );
                if (data.role === "admin"){
                    router.push("/admin");
                } else {
                    router.push(`/profile/${data.nickname}`);
                }

            }
    
        };
        setLoading(true);
        const { data: authListener } = SCM.onAuthStateChange(checkUser);
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [router, dispatch]);
    

    const signInWithGoogle = async () => {
        const { error: err } = await SCM.loginByGoogle(location.origin);
        if (err) {
            if (err instanceof Error) {
                setErrorModalView({
                    ErrName: err.name,
                    ErrMessage: err.message,
                    ErrStackRace: err.stack,
                    inputValue: null
                });

            } else {
                setErrorModalView({
                    ErrName: null,
                    ErrMessage: null,
                    ErrStackRace: err as string,
                    inputValue: null
                });
            }
        }
    };

    const completeSignup = async () => {
        setLoading(true);
        setNicknameError("");

        const session = await SCM.get().session();
        if (!session.data.session) {
            setLoading(false);
            return;
        }

        // 닉네임 중복 확인
        const { data: checkData, error: checkErr } = await SCM.get().usersByNickname(nickname);
        if (checkErr) {
            setErrorModalView({
                ErrName: checkErr.name,
                ErrMessage: checkErr.message,
                ErrStackRace: checkErr.stack,
                inputValue: null
            });

            setLoading(false);
            return;
        }
        if (checkData.length > 0) {
            setNicknameError("이미 사용 중인 닉네임입니다.");
            setLoading(false);
            return;
        }

        // 닉네임 등록
        const { data, error:err } = await SCM.add().nickname(session.data.session.user.id, nickname)

        if (err) {
            setErrorModalView({
                ErrName: err.name,
                ErrMessage: err.message,
                ErrStackRace: err.stack,
                inputValue: null
            });
            
            setLoading(false);
            return;
        }

        dispatch(
            userAction.setInfo({
                username: data.nickname,
                role: data.role ?? "guest",
                uuid: data.id,
            })
        );
        router.push("/");
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
            <div className="w-full max-w-md">
                <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                    <CardHeader className="space-y-4 text-center pb-8">
                        <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            {isNewUser ? (
                                <UserPlus className="h-6 w-6 text-white" />
                            ) : (
                                <LogIn className="h-6 w-6 text-white" />
                            )}
                        </div>
                        <CardTitle className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                            {isNewUser ? "회원가입" : "환영합니다"}
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">
                            {isNewUser 
                                ? "서비스 이용을 위해 닉네임을 설정해주세요" 
                                : "Google 계정으로 간편하게 시작하세요"
                            }
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-6">
                        {isNewUser ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="text"
                                            placeholder="닉네임을 입력하세요"
                                            value={nickname}
                                            onChange={(e) => setNickname(e.target.value)}
                                            className="pl-10 h-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            disabled={loading}
                                        />
                                    </div>
                                    {nicknameError && (
                                        <Alert variant="destructive" className="py-2">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription className="text-sm">
                                                {nicknameError}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                                
                                <Button
                                    onClick={completeSignup}
                                    disabled={!nickname.trim() || loading}
                                    className="w-full h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            가입 중...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="mr-2 h-4 w-4" />
                                            회원가입 완료
                                        </>
                                    )}
                                </Button>
                                
                                <p className="text-xs text-slate-500 dark:text-slate-400 text-center leading-relaxed">
                                    가입을 하는 것은{" "}
                                    <a 
                                        href="/terms" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors"
                                    >
                                        운영정책
                                    </a>
                                    과{" "}
                                    <a 
                                        href="/privacy" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors"
                                    >
                                        개인정보처리방침
                                    </a>
                                    을 동의하는 것으로 간주됩니다.
                                </p>
                            </div>
                        ) : (
                            <Button
                                onClick={signInWithGoogle}
                                disabled={loading}
                                className="w-full h-12 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-medium transition-all duration-200 shadow-sm"
                                variant="outline"
                            >
                                Google로 계속하기
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* 로딩 오버레이 */}
                {loading && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
                        <Card className="p-6">
                            <div className="flex items-center space-x-3">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                <span className="text-slate-700 dark:text-slate-300">
                                    {isNewUser ? "회원가입 처리 중..." : "로그인 처리 중..."}
                                </span>
                            </div>
                        </Card>
                    </div>
                )}

                {/* 오류 모달 */}
                {errorModalView && (
                    <ErrorModal 
                        error={errorModalView} 
                        onClose={() => setErrorModalView(null)}
                    />
                )}
            </div>
        </div>
    );
};

const Auth = () => {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <Card className="p-8">
                    <div className="flex items-center space-x-3">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        <span className="text-slate-700 dark:text-slate-300">로딩 중...</span>
                    </div>
                </Card>
            </div>
        }>
            <AuthPage />
        </Suspense>
    );
};

export default Auth;