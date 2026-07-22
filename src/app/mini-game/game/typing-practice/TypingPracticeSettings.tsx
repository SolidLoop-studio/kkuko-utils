"use client";

import React from 'react';
import type { TypingPracticeSettings } from './types/typing-practice.types';

type TypingPracticeSettingsPanelProps = {
    value: TypingPracticeSettings;
    onChange: (next: TypingPracticeSettings) => void;
};

const TypingPracticeSettingsPanel = ({ value, onChange }: TypingPracticeSettingsPanelProps) => {
    const [minLengthInput, setMinLengthInput] = React.useState(String(value.minLength));

    React.useEffect(() => {
        setMinLengthInput(String(value.minLength));
    }, [value]);

    const update = (partial: Partial<TypingPracticeSettings>) => {
        onChange({ ...value, ...partial });
    };

    return (
        <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">타자 연습 설정</h2>

            <div>
                <label htmlFor="typing-session-mode" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">세션 방식</label>
                <select
                    id="typing-session-mode"
                    value={value.sessionMode}
                    onChange={(event) => update({ sessionMode: event.target.value as TypingPracticeSettings['sessionMode'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="timed">시간 제한</option>
                    <option value="fixed-count">단어 수 제한</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-duration" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">연습 시간</label>
                <select
                    id="typing-duration"
                    value={value.durationSeconds}
                    onChange={(event) => update({ sessionMode: 'timed', durationSeconds: Number(event.target.value) as TypingPracticeSettings['durationSeconds'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value={30}>30초</option>
                    <option value={60}>60초</option>
                    <option value={120}>120초</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-word-count" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">단어 수</label>
                <select
                    id="typing-word-count"
                    value={value.wordCount}
                    onChange={(event) => update({ sessionMode: 'fixed-count', wordCount: Number(event.target.value) as TypingPracticeSettings['wordCount'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value={10}>10개</option>
                    <option value={25}>25개</option>
                    <option value={50}>50개</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-language" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">언어</label>
                <select
                    id="typing-language"
                    value={value.language}
                    onChange={(event) => update({ language: event.target.value as TypingPracticeSettings['language'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="all">전체</option>
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-order" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">단어 순서</label>
                <select
                    id="typing-order"
                    value={value.order}
                    onChange={(event) => update({ order: event.target.value as TypingPracticeSettings['order'] })}
                    className="w-full px-3 py-2 border rounded-lg"
                >
                    <option value="random">랜덤</option>
                    <option value="sorted">가나다순</option>
                </select>
            </div>

            <div>
                <label htmlFor="typing-min-length" className="block text-sm text-gray-700 dark:text-gray-200 mb-2">최소 글자 수</label>
                <input
                    id="typing-min-length"
                    type="number"
                    min={2}
                    max={10}
                    value={minLengthInput}
                    onChange={(event) => {
                        setMinLengthInput(event.target.value);
                        update({ minLength: Math.min(10, Math.max(2, Number(event.target.value) || 2)) });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                />
            </div>
        </div>
    );
};

export default TypingPracticeSettingsPanel;
