"use client";
import React, { useState } from "react";
import { Search, User, Crown, Star, Trophy, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { SCM } from "../lib/supabaseClient";
import ErrorModal from "../components/ErrModal";
import Link from "next/link";

type role = "r1" | "r2" | "r3" | "r4" | "admin";
type user = {
  id: string;
  nickname: string;
  contribution: number;
  month_contribution: number;
  role: role;
};

const roleLabels = {
  r1: "새싹",
  r2: "일반",
  r3: "활동가",
  r4: "베테랑",
  admin: "관리자",
};

const roleVariants = {
  r1: "secondary",
  r2: "default",
  r3: "outline",
  r4: "destructive",
  admin: "default",
} as const;

const getRoleIcon = (role: role) => {
  switch (role) {
    case "admin":
      return <Crown className="w-4 h-4" />;
    case "r4":
      return <Trophy className="w-4 h-4" />;
    case "r3":
      return <Star className="w-4 h-4" />;
    default:
      return <User className="w-4 h-4" />;
  }
};

export default function ProfileHomePage() {
  const [searchInput, setSearchInput] = useState("");
  const [resultUsers, setResultUsers] = useState<user[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorModalView, setErrorModalView] = useState<ErrorMessage | null>(null);

  const handleSearch = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1));
    const { data, error } = await SCM.get().usersLikeByNickname(searchInput)
    if (error){
        setIsLoading(false);
        setResultUsers([]);
        setErrorModalView({
            ErrName: error.name,
            ErrMessage: error.message,
            ErrStackRace: error.code,
            inputValue: "유저 검색",
        })
        return
    }
    setSearchInput("");
    setResultUsers(data)
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">유저 검색</h1>
        </div>

        {/* 검색 */}
        <Card className="mb-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground dark:text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="닉네임으로 검색..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="pl-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  className="flex items-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  검색
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 검색 결과 통계 */}
        <div className="mb-4">
          <p className="text-gray-600 dark:text-gray-300">
            총 {resultUsers.length}명의 유저가 검색되었습니다
          </p>
        </div>

        {/* 유저 목록 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resultUsers.map((user) => (
            <Card key={user.id} className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-muted-foreground dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {user.nickname}
                    </h3>
                    <Badge variant={roleVariants[user.role]} className="mt-1">
                      <div className="flex items-center gap-1">
                        {getRoleIcon(user.role)}
                        {roleLabels[user.role as role]}
                      </div>
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* 기여도 정보 */}
                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground dark:text-gray-400">
                      총 기여도
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {user.contribution.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground dark:text-gray-400">
                      월간 기여도
                    </span>
                    <span className="font-semibold text-primary">
                      {user.month_contribution.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <Link href={`/profile/${user.nickname}`}>
                  <Button className="w-full" variant="default">
                    프로필 보기
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 검색 결과가 없을 때 */}
        {resultUsers.length === 0 && (
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <CardContent className="text-center py-12">
              <User className="w-16 h-16 text-muted-foreground dark:text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-muted-foreground dark:text-gray-400">
                다른 검색어를 시도해보세요
              </p>
            </CardContent>
          </Card>
        )}

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <Card className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="text-slate-700 dark:text-slate-300">
                  검색 중입니다...
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
}
