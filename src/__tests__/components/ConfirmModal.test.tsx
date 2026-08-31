import { render, screen } from '@testing-library/react';

import ConfirmModal from '@/src/app/components/ConfirmModal';

describe('ConfirmModal', () => {
    test('associates its description with the confirmation dialog', () => {
        // Break caught: rendering visible helper text that assistive technology cannot identify as the dialog description.
        render(
            <ConfirmModal
                open
                title="로그 삭제"
                description="2개의 로그가 삭제됩니다."
                onConfirm={jest.fn()}
                onClose={jest.fn()}
            />,
        );

        expect(screen.getByRole('dialog')).toHaveAccessibleDescription('2개의 로그가 삭제됩니다.');
    });
});
