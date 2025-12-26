import React, { useEffect, useRef } from 'react';
import HelpModal from '@/app/components/HelpModal';

interface HelpModalprop {
    wantGo?: 1 | 2 | 3 | 4 | 5;
}

const HelpModalB = ({ wantGo }: HelpModalprop) => {
    // 각 섹션에 대한 
    const sortRef1 = useRef<HTMLHeadingElement>(null);
    const sortRef2 = useRef<HTMLHeadingElement>(null);
    const sortRef3 = useRef<HTMLHeadingElement>(null);
    const sortRef4 = useRef<HTMLHeadingElement>(null);

    const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        if (wantGo) {
            switch (wantGo) {
                case 2:
                    scrollToSection(sortRef1);
                    break;
                case 3:
                    scrollToSection(sortRef2);
                    break;
                case 4:
                    scrollToSection(sortRef3);
                    break;
                case 5:
                    scrollToSection(sortRef4);
                    break;
            }
        }
    });

    return (
        <div >
            {/* 목차 */}
            <ul className="mb-6 space-y-2">
                <li>
                    <button
                        className="text-blue-500 dark:text-blue-400 hover:underline"
                        onClick={() => scrollToSection(sortRef1)}
                    >
                        ㄱㄴㄷ순 정렬 v1
                    </button>
                </li>
                <li>
                    <button
                        className="text-blue-500 dark:text-blue-400 hover:underline"
                        onClick={() => scrollToSection(sortRef2)}
                    >
                        ㄱㄴㄷ순 정렬 v2
                    </button>
                </li>
                <li>
                    <button
                        className="text-blue-500 dark:text-blue-400 hover:underline"
                        onClick={() => scrollToSection(sortRef3)}
                    >
                        ㄱㄴㄷ순 정렬 v3
                    </button>
                </li>
                <li>
                    <button
                        className="text-blue-500 dark:text-blue-400 hover:underline"
                        onClick={() => scrollToSection(sortRef4)}
                    >
                        ㄱㄴㄷ순 정렬 v4
                    </button>
                </li>
            </ul>

            {/* 본문 */}
            <div>
                <h3
                    ref={sortRef1}
                    className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100"
                >
                    ㄱㄴㄷ순 정렬 v1
                </h3>

                <p className="text-gray-700 dark:text-gray-300 mb-4">
                    v1 버전은 기본적인 정렬 방법을 사용합니다.
                </p>

                <pre className="bg-gray-100 dark:bg-gray-800 text-sm p-3 rounded-md text-gray-800 dark:text-gray-200 mb-4">
                    {`나릅\n개두릅\n주릅\n사릅`}<br /> → <br />{`개두릅\n나릅\n사릅\n주릅`}
                </pre>

                <h3
                    ref={sortRef2}
                    className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100"
                >
                    ㄱㄴㄷ순 정렬 v2
                </h3>

                <p className="text-gray-700 dark:text-gray-300">
                    v2 버전은 앞글자가 같은것 끼리 모아서 정렬합니다.
                </p>

                <pre className="bg-gray-100 dark:bg-gray-800 text-sm p-3 rounded-md text-gray-800 dark:text-gray-200">
                    {`나릅\n개두릅\n주릅\n사릅`} <br />→<br />{`=[개]=\n개두릅\n\n=[나]=\n나릅\n\n=[사]=\n사릅\n\n=[주]=\n주릅`}
                </pre>

                <h3
                    ref={sortRef3}
                    className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100"
                >
                    ㄱㄴㄷ순 정렬 v3
                </h3>

                <p className="text-gray-700 dark:text-gray-300">
                    v3 버전은 한글 앞글자순으로 정렬하고 길이별로 정렬합니다.
                </p>

                <pre className="bg-gray-100 dark:bg-gray-800 text-sm p-3 rounded-md text-gray-800 dark:text-gray-200">
                    {`가끔가끔\n가격\n오늘\n오글오글`} <br />→<br />{`가끔가끔\n가격\n오글오글\n오늘`}
                </pre>

                <h3
                    ref={sortRef4}
                    className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100"
                >
                    ㄱㄴㄷ순 정렬 v4
                </h3>

                <p className="text-gray-700 dark:text-gray-300">
                    v4 버전은 한글 앞글자순으로 정렬하고 길이별로 정렬한후 그룹으로 묶습니다.
                </p>

                <pre className="bg-gray-100 dark:bg-gray-800 text-sm p-3 rounded-md text-gray-800 dark:text-gray-200">
                    {`나비야\n가나다라마바사\n나비\n난방\n가로`} <br />→<br />{`=[가]=\n가나다라마바사\n가로\n\n=[나]=\n나비\n나비야\n\n=[난]=\n난방`}
                </pre>
            </div>
        </div>
    )
}

export default function HelpModalC({ wantGo }: HelpModalprop) {
    return (
        <HelpModal title={"단어장 정리 도구 도움말"}>
            <HelpModalB wantGo={wantGo} />
        </HelpModal>
    )
}