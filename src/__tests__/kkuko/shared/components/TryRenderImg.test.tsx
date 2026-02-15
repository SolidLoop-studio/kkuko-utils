import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TryRenderImg from '@/src/app/kkuko/shared/components/TryRenderImg';

// Mock next/image
jest.mock("next/image", () => ({ src, alt, onError, onLoad, ...props }: any) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img 
    src={src} 
    alt={alt} 
    onError={onError} 
    onLoad={onLoad} 
    data-testid="next-image"
    {...props} 
  />
));

describe('TryRenderImg', () => {
    const defaultProps = {
        url: 'https://example.com/image.png',
        alt: 'Test Image',
        width: 100,
        height: 100,
        maxRetries: 2,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Date.now mock to have deterministic timestamps for src verification
        jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should render the image initially', () => {
        render(<TryRenderImg {...defaultProps} />);
        const img = screen.getByTestId('next-image');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', defaultProps.url);
        expect(img).toHaveAttribute('alt', defaultProps.alt);
    });

    it('should call handleLoad when image loads successfully', () => {
        const handleLoad = jest.fn();
        render(<TryRenderImg {...defaultProps} hanldeLoad={handleLoad} />);
        const img = screen.getByTestId('next-image');
        
        fireEvent.load(img);
        
        expect(handleLoad).toHaveBeenCalled();
    });

    it('should retry loading on error up to maxRetries', () => {
        render(<TryRenderImg {...defaultProps} />);
        const img = screen.getByTestId('next-image');
        
        // First error -> retry 1
        fireEvent.error(img);
        
        // Expect src to have changed
        // url + ?r=1&ts=...
        const expectedSrc1 = `${defaultProps.url}?r=1&ts=1234567890`;
        expect(img).toHaveAttribute('src', expectedSrc1);

        // Second error -> retry 2
        fireEvent.error(img);
        const expectedSrc2 = `${defaultProps.url}?r=2&ts=1234567890`;
        expect(img).toHaveAttribute('src', expectedSrc2);
    });

    it('should show placeholder and call onFailure after maxRetries exceeded', () => {
        const onFailure = jest.fn();
        const placeholderText = "Placeholder Content";
        
        render(
            <TryRenderImg 
                {...defaultProps} 
                onFailure={onFailure} 
                placeholder={<div>{placeholderText}</div>} 
            />
        );
        
        const img = screen.getByTestId('next-image');
        
        // Retry 1
        fireEvent.error(img);
        // Retry 2
        fireEvent.error(img);
        
        // Final error (attempt becomes 2 (which is < maxRetries if maxRetries is 3, but here props says 2?))
        // Logic check:
        // attempt starts at 0.
        // handleError: if (attempt < maxRetries) { ... setAttempt(attempt + 1) ... } else { fail }
        // props.maxRetries = 2.
        // 1. attempt 0 < 2 -> setAttempt(1), retry.
        // 2. attempt 1 < 2 -> setAttempt(2), retry.
        // 3. attempt 2 is NOT < 2 -> fail.
        
        // So we need 3 errors to fail.
        fireEvent.error(img);

        expect(onFailure).toHaveBeenCalled();
        expect(screen.queryByTestId('next-image')).not.toBeInTheDocument();
        expect(screen.getByText(placeholderText)).toBeInTheDocument();
    });

    it('should reset state when url prop changes', () => {
        const { rerender } = render(<TryRenderImg {...defaultProps} />);
        const img = screen.getByTestId('next-image');
        
        // Trigger one error to change state
        fireEvent.error(img);
        expect(img).toHaveAttribute('src', expect.stringContaining('?r=1'));
        
        // Change URL
        const newUrl = 'https://example.com/new.png';
        rerender(<TryRenderImg {...defaultProps} url={newUrl} />);
        
        const newImg = screen.getByTestId('next-image');
        expect(newImg).toHaveAttribute('src', newUrl);
        // Should not have query params yet
        expect(newImg).not.toHaveAttribute('src', expect.stringContaining('?r='));
    });
});
