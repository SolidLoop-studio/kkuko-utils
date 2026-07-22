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
    it('updates duration, language, order, and minimum length', async () => {
        const user = userEvent.setup();
        const onChange = jest.fn();

        render(<TypingPracticeSettingsPanel value={value} onChange={onChange} />);

        await user.selectOptions(screen.getByLabelText('연습 시간'), '120');
        expect(onChange).toHaveBeenCalledWith({ ...value, sessionMode: 'timed', durationSeconds: 120 });

        await user.selectOptions(screen.getByLabelText('언어'), 'ko');
        expect(onChange).toHaveBeenCalledWith({ ...value, language: 'ko' });

        await user.selectOptions(screen.getByLabelText('단어 순서'), 'sorted');
        expect(onChange).toHaveBeenCalledWith({ ...value, order: 'sorted' });

        await user.clear(screen.getByLabelText('최소 글자 수'));
        await user.type(screen.getByLabelText('최소 글자 수'), '4');
        expect(onChange).toHaveBeenLastCalledWith({ ...value, minLength: 4 });
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
