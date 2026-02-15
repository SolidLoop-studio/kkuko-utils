"use client";
import React, { useRef } from "react";
import HelpModal from "@/src/app/components/HelpModal";

const HelpModalB = () => {
    const Mod1Ref = useRef<HTMLHeadingElement>(null);
    const Mod2Ref = useRef<HTMLHeadingElement>(null);
    const Mod3Ref = useRef<HTMLHeadingElement>(null);
    const Mod4Ref = useRef<HTMLHeadingElement>(null);

    const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
        if (ref.current) {
            ref.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div>
            {/* 목차 */}
            <ul className="mb-6 space-y-4">
                {["모드 1", "모드 2", "모드 3", "모드 4"].map((mode, index) => (
                    <li key={index}>
                        <button
                            className="text-blue-600 font-semibold hover:underline flex items-center gap-2 dark:text-blue-400"
                            onClick={() => scrollToSection([Mod1Ref, Mod2Ref, Mod3Ref, Mod4Ref][index])}
                        >
                            <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center dark:bg-blue-400 dark:text-blue-900">
                                {index + 1}
                            </span>
                            {mode}
                        </button>
                    </li>
                ))}
            </ul>

            {/* 본문 */}
            <div className="space-y-6">
                <div>
                    <h3 ref={Mod1Ref} className="text-xl font-semibold mb-2 border-b pb-2 text-gray-900 dark:text-white">모드 1</h3>
                    <p className="text-gray-600 dark:text-gray-300">[입력한 글자]--[입력한 글자]의 형식으로 추출됩니다.</p>
                    <p>예시</p>
                    <pre className="bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                        라메디아노체루나라 <br />
                        라멜라 <br />
                        라미아벨라 <br />
                        라비린툴라 <br />
                        라사라 <br />
                    </pre>
                </div>
                <div>
                    <h3 ref={Mod2Ref} className="text-xl font-semibold mb-2 border-b pb-2 text-gray-900 dark:text-white">모드 2</h3>
                    <p className="text-gray-600 dark:text-gray-300">[입력한 글자(두음 허용)]--[입력한 글자]의 형식으로 추출됩니다.</p>
                    <p>예시</p>
                    <pre className="bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                        나라없는나라 <br />
                        나를인간이라고부르지말라 <br />
                        라미아벨라 <br />
                        라비린툴라 <br />
                        라사라 <br />
                    </pre>
                </div>
                <div>
                    <h3 ref={Mod3Ref} className="text-xl font-semibold mb-2 border-b pb-2 text-gray-900 dark:text-white">모드 3</h3>
                    <p className="text-gray-600 dark:text-gray-300">[입력한 글자]--[입력한 글자(두음 허용)]의 형식으로 추출됩니다.</p>
                    <p>예시</p>
                    <pre className="bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                        라그나로스님의힘이느껴지는구나 <br />
                        라바하운드와불타오르는아레나 <br />
                        라미아벨라 <br />
                        라비린툴라 <br />
                        라사라 <br />
                    </pre>
                </div>
                <div>
                    <h3 ref={Mod4Ref} className="text-xl font-semibold mb-2 border-b pb-2 text-gray-900 dark:text-white">모드 4</h3>
                    <p className="text-gray-600 dark:text-gray-300">[입력한 글자(두음 허용)]--[입력한 글자(두음 허용)]의 형식으로 추출됩니다.</p>
                    <p>예시</p>
                    <pre className="bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white p-4 rounded-md overflow-x-auto whitespace-pre-wrap">
                        나가르주나 <br />
                        나라없는나라 <br />
                        라그나로스님의힘이느껴지는구나 <br />
                        라비린툴라 <br />
                        라사라 <br />
                    </pre>
                </div>
            </div>
        </div>
    )
}



export default function HelpModalC() {
    return (
        <HelpModal
            title={"돌림 단어 추출 모드 도움말"}
        >
            <HelpModalB />
        </HelpModal>
    )
}