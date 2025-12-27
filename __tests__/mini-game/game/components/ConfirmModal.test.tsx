import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '@/app/mini-game/game/components/ConfirmModal';

describe('ConfirmModal', () => {
    it('should render message', () => {
        render(<ConfirmModal message="Are you sure?" onConfirm={() => {}} onCancel={() => {}} />);
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('should call onConfirm when confirm button is clicked', () => {
        const onConfirm = jest.fn();
        render(<ConfirmModal message="Test" onConfirm={onConfirm} onCancel={() => {}} />);
        // Use regex or exact match depending on button text
        fireEvent.click(screen.getByRole('button', { name: '확인' }));
        expect(onConfirm).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button is clicked', () => {
        const onCancel = jest.fn();
        render(<ConfirmModal message="Test" onConfirm={() => {}} onCancel={onCancel} />);
        fireEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when clicking backdrop', () => {
        const onCancel = jest.fn();
        const { container } = render(<ConfirmModal message="Test" onConfirm={() => {}} onCancel={onCancel} />);
        // The backdrop is the outer div
        fireEvent.click(container.firstChild as Element);
        expect(onCancel).toHaveBeenCalled();
    });

    it('should not call onCancel when clicking modal content', () => {
        const onCancel = jest.fn();
        render(<ConfirmModal message="Test" onConfirm={() => {}} onCancel={onCancel} />);
        // Click on the message div which is inside the modal
        fireEvent.click(screen.getByText('Test'));
        expect(onCancel).not.toHaveBeenCalled();
    });
});