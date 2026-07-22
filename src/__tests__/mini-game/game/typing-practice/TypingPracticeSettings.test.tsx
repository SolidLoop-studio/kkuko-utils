import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import TypingPracticeSettingsPanel from '@/src/app/mini-game/game/typing-practice/TypingPracticeSettings';
import type { TypingPracticeSettings } from '@/src/app/mini-game/game/typing-practice/types/typing-practice.types';

const value: TypingPracticeSettings = {
    sessionMode: 'timed',
    durationSeconds: 60,
    wordCount: 25,
    language: 'all',
    order: 'random',
    minLength: 2,
};

describe('TypingPracticeSettingsPanel', () => {
    it('uses radio-style controls and conditionally shows timed settings', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();

        render(<TypingPracticeSettingsPanel value={value} onChange={onChange} />);

        expect(screen.getByRole('radio', { name: '시간 제한' })).toBeChecked();
        expect(screen.getByRole('radio', { name: '단어 수 제한' })).not.toBeChecked();
        expect(screen.getByText('연습 시간')).toBeInTheDocument();
        expect(screen.queryByText('단어 수')).not.toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: '120초' }));
        expect(onChange).toHaveBeenCalledWith({ ...value, sessionMode: 'timed', durationSeconds: 120 });

        await user.click(screen.getByRole('radio', { name: '한국어' }));
        expect(onChange).toHaveBeenCalledWith({ ...value, language: 'ko' });

        await user.click(screen.getByRole('radio', { name: '가나다순' }));
        expect(onChange).toHaveBeenCalledWith({ ...value, order: 'sorted' });

        await user.clear(screen.getByLabelText('최소 글자 수'));
        await user.type(screen.getByLabelText('최소 글자 수'), '4');
        expect(onChange).toHaveBeenLastCalledWith({ ...value, minLength: 4 });
    });

    it('shows only word-count choices in fixed-count mode', () => {
        render(<TypingPracticeSettingsPanel value={{ ...value, sessionMode: 'fixed-count' }} onChange={jest.fn()} />);

        expect(screen.queryByText('연습 시간')).not.toBeInTheDocument();
        expect(screen.getByText('단어 수')).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: '25개' })).toBeChecked();
    });

    it('restores the minimum length when a controlled parent applies the lower bound', async () => {
        const user = userEvent.setup();

        const ControlledSettingsPanel = () => {
            const [setting, setSetting] = useState(value);

            return <TypingPracticeSettingsPanel value={setting} onChange={setSetting} />;
        };

        render(<ControlledSettingsPanel />);

        await user.clear(screen.getByLabelText('최소 글자 수'));

        expect(screen.getByLabelText('최소 글자 수')).toHaveValue(2);
    });
});
