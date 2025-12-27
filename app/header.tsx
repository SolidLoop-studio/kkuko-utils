"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDispatch, useSelector } from 'react-redux';
import { Menu, X, User, ChevronDown, LayoutDashboard, Sun, Moon } from 'lucide-react';
import type { RootState, AppDispatch } from "./store/store";
import { SCM } from "./lib/supabaseClient";
import { useRouter } from "next/navigation";
import { userAction } from "./store/slice";
import { useTheme } from 'next-themes'

const Header = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);
    const profileDropdownRef = useRef<HTMLDivElement>(null);
    const isLoggedIn = useSelector((state: RootState) => state.user.username) !== undefined; 
    const user = useSelector((state: RootState) => state.user); 
    const pathname = usePathname();
    const router = useRouter();
    const dispatch = useDispatch<AppDispatch>();
    const username=user.username;
    const { theme, setTheme } = useTheme();

    const handleLogout = async () => {
        await SCM.logout();
        dispatch(
            userAction.setInfo({
                username: undefined,
                role: "guest",
            })
        );
        router.push("/");
    };

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // 모바일 메뉴 외부 클릭 감지
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
            
            // 프로필 드롭다운 외부 클릭 감지
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 경로 변경 시 메뉴 닫기
    useEffect(() => {
        setIsOpen(false);
        setIsProfileOpen(false);
    }, [pathname]);

    const toggleTheme = () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
    }

    const navItems = [
        { href: "/word-combiner", label: "단어조합기", isActive: pathname === "/word-combiner" },
        { href: "/manager-tool", label: "단어장 관리 도구", isActive: pathname.includes('manager-tool') },
        { href: "/words-docs", label: "단어장 공유", isActive: pathname.includes('words-docs') },
        { href: "/word", label: "오픈DB", isActive: pathname==='/word' || pathname.includes('/word/') },
        { href: "/openapi", label: "오픈API", isActive: pathname.includes('/openapi') },
        { 
            href: "/extra-features", 
            label: "기타 기능", 
            isActive: !(pathname === "/word-combiner") && 
            !(pathname.includes('manager-tool')) && 
            !(pathname.includes('words-docs')) && 
            !(pathname === "/") && 
            !(pathname.includes('admin')) &&
            !(pathname.includes('/word/')) &&
            pathname !=='/word' &&
            !pathname.includes('/openapi')
        }
    ];

    return (
        <header className="bg-gradient-to-r from-slate-900 via-gray-900 to-slate-900 text-white shadow-xl border-b border-gray-700">
            <nav className="container mx-auto px-6 py-4">
                <div className="flex justify-between items-center">
                    {/* 로고 */}
                    <div className="text-2xl font-bold">
                        <Link href="/">
                            <span className="hover:text-blue-400 transition-all duration-300 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                Kkuko utils
                            </span>
                        </Link>
                    </div>

                    {/* 햄버거 메뉴 버튼 (모바일) */}
                    <div className="md:hidden" ref={mobileMenuRef}>
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="text-gray-300 hover:text-white focus:outline-none p-2 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            {isOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>

                    {/* 데스크톱 네비게이션 */}
                    <div className="hidden md:flex items-center space-x-8">
                        {navItems.map((item) => (
                            <Link 
                                key={item.href}
                                href={item.href} 
                                className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:text-blue-400 hover:bg-gray-800/50 ${
                                    item.isActive 
                                        ? "text-blue-400 bg-gray-800/70" 
                                        : "text-gray-300"
                                }`}
                            >
                                {item.label}
                                {item.isActive && (
                                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full"></div>
                                )}
                            </Link>
                        ))}
                    </div>

                    {/* 데스크톱 테마 토글 & 프로필 영역 */}
                    <div className="hidden md:flex items-center space-x-4">
                        {/* 테마 토글 버튼 */}
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg hover:bg-gray-800/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            aria-label="테마 변경"
                        >
                            {theme === 'dark' ? (
                                <Sun size={20} className="text-yellow-400" />
                            ) : (
                                <Moon size={20} className="text-blue-400" />
                            )}
                        </button>

                        {/* 프로필 드롭다운 */}
                        <div className="relative" ref={profileDropdownRef}>
                            <button
                                onClick={() => setIsProfileOpen(!isProfileOpen)}
                                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            >
                                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
                                    <User size={18} className="text-white" />
                                </div>
                                <ChevronDown 
                                    size={16} 
                                    className={`text-gray-400 transition-transform duration-200 ${
                                        isProfileOpen ? 'rotate-180' : ''
                                    }`} 
                                />
                            </button>

                            {isProfileOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white text-gray-900 rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50">
                                    <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-100">
                                        {isLoggedIn ? (
                                            <>
                                                <p className="text-sm text-gray-600">안녕하세요,</p>
                                                <p className="font-semibold text-gray-800">{username}님</p>
                                            </>
                                        ) : (
                                            <p className="text-sm text-gray-600">로그인하세요</p>
                                        )}
                                    </div>
                                    <div className="py-2">
                                        <Link href={isLoggedIn ? `/profile/${username}` : "/auth"}>
                                            <div className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                                                <User size={16} className="mr-3 text-gray-500" />
                                                {isLoggedIn ? "프로필 페이지" : "로그인"}
                                            </div>
                                        </Link>
                                        {isLoggedIn && (
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center px-4 py-3 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-colors text-left"
                                            >
                                                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                로그아웃
                                            </button>
                                        )}
                                        {['r4','admin'].includes(user.role) && (
                                            <Link 
                                            href={`/admin`}
                                            className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                            >
                                                <LayoutDashboard size={16} className="mr-3 text-gray-500" />
                                                관리자 페이지
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 모바일 네비게이션 */}
                <div 
                    ref={mobileMenuRef}
                    className={`md:hidden transition-all duration-300 ease-in-out ${
                        isOpen ? "max-h-96 opacity-100 mt-4 overflow-y-auto" : "max-h-0 opacity-0 overflow-hidden"
                    }`}
                >
                    <div className="space-y-2 py-4 border-t border-gray-700">
                        {navItems.map((item) => (
                            <Link 
                                key={item.href}
                                href={item.href} 
                                className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                                    item.isActive 
                                        ? "text-blue-400 bg-gray-800/70" 
                                        : "text-gray-300 hover:text-blue-400 hover:bg-gray-800/50"
                                }`}
                            >
                                {item.label}
                            </Link>
                        ))}
                        
                        {/* 모바일 프로필 섹션 */}
                        <div className="pt-4 mt-4 border-t border-gray-700">
                            {/* 모바일 테마 토글 버튼 */}
                            <div className="px-4 py-2 mb-2">
                                <button
                                    onClick={toggleTheme}
                                    className="flex items-center space-x-3 w-full px-3 py-2 rounded-lg hover:bg-gray-800/50 transition-all duration-300 text-gray-300 hover:text-blue-400"
                                    aria-label="테마 변경"
                                >
                                    {theme === 'dark' ? (
                                        <>
                                            <Sun size={18} className="text-yellow-400" />
                                            <span className="text-sm">라이트 모드</span>
                                        </>
                                    ) : (
                                        <>
                                            <Moon size={18} className="text-blue-400" />
                                            <span className="text-sm">다크 모드</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            {isLoggedIn ? (
                                <>
                                    <div className="px-4 py-2 text-sm text-gray-400">
                                        안녕하세요, <span className="text-white font-medium">{username}</span>님
                                    </div>
                                    <Link 
                                        href={`/profile/${username}`}
                                        className="block px-4 py-3 text-gray-300 hover:text-blue-400 hover:bg-gray-800/50 rounded-lg transition-colors"
                                    >
                                        프로필 페이지
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-3 text-gray-300 hover:text-red-400 hover:bg-gray-800/50 rounded-lg transition-colors"
                                    >
                                        로그아웃
                                    </button>
                                    {['r4','admin'].includes(user.role) && (
                                        <Link 
                                        href={`/admin`}
                                        className="block px-4 py-3 text-gray-300 hover:text-blue-400 hover:bg-gray-800/50 rounded-lg transition-colors"
                                        >
                                            관리자 페이지
                                        </Link>
                                    )}
                                </>
                            ) : (
                                <Link 
                                    href="/auth"
                                    className="block px-4 py-3 text-gray-300 hover:text-blue-400 hover:bg-gray-800/50 rounded-lg transition-colors"
                                >
                                    로그인
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Header;