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

    const renderRadio = (
        name: string,
        label: string,
        checked: boolean,
        onSelect: () => void,
    ) => (
        <label className="inline-flex items-center gap-2">
            <input type="radio" name={name} checked={checked} onChange={onSelect} />
            <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
        </label>
    );

    return (
        <div className="space-y-3">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">타자 연습 설정</h2>

            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-200 mb-2">세션 방식</label>
                <div className="flex gap-3">
                    {renderRadio('typing-session-mode', '시간 제한', value.sessionMode === 'timed', () => update({ sessionMode: 'timed' }))}
                    {renderRadio('typing-session-mode', '단어 수 제한', value.sessionMode === 'fixed-count', () => update({ sessionMode: 'fixed-count' }))}
                </div>
            </div>

            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-200 mb-2">
                    {value.sessionMode === 'timed' ? '연습 시간' : '단어 수'}
                </label>
                <div className="flex flex-wrap gap-3">
                    {value.sessionMode === 'timed' ? (
                        <>
                            {renderRadio('typing-duration', '30초', value.durationSeconds === 30, () => update({ sessionMode: 'timed', durationSeconds: 30 }))}
                            {renderRadio('typing-duration', '60초', value.durationSeconds === 60, () => update({ sessionMode: 'timed', durationSeconds: 60 }))}
                            {renderRadio('typing-duration', '120초', value.durationSeconds === 120, () => update({ sessionMode: 'timed', durationSeconds: 120 }))}
                        </>
                    ) : (
                        <>
                            {renderRadio('typing-word-count', '10개', value.wordCount === 10, () => update({ sessionMode: 'fixed-count', wordCount: 10 }))}
                            {renderRadio('typing-word-count', '25개', value.wordCount === 25, () => update({ sessionMode: 'fixed-count', wordCount: 25 }))}
                            {renderRadio('typing-word-count', '50개', value.wordCount === 50, () => update({ sessionMode: 'fixed-count', wordCount: 50 }))}
                        </>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-200 mb-2">언어</label>
                <div className="flex gap-3">
                    {renderRadio('typing-language', '전체', value.language === 'all', () => update({ language: 'all' }))}
                    {renderRadio('typing-language', '한국어', value.language === 'ko', () => update({ language: 'ko' }))}
                    {renderRadio('typing-language', 'English', value.language === 'en', () => update({ language: 'en' }))}
                </div>
            </div>

            <div>
                <label className="block text-sm text-gray-700 dark:text-gray-200 mb-2">단어 순서</label>
                <div className="flex gap-3">
                    {renderRadio('typing-order', '랜덤', value.order === 'random', () => update({ order: 'random' }))}
                    {renderRadio('typing-order', '가나다순', value.order === 'sorted', () => update({ order: 'sorted' }))}
                </div>
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
