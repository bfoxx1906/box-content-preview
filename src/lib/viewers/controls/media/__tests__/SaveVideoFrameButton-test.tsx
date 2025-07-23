import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaveVideoFrameButton from '../SaveVideFrameButton';

// Mock console.error to avoid noise in tests
global.console.error = jest.fn();

describe('SaveVideoFrameButton', () => {
    const mockVideoElement = {
        videoWidth: 1920,
        videoHeight: 1080,
    } as HTMLVideoElement;

    const getWrapper = (props = {}) => render(<SaveVideoFrameButton videoElement={mockVideoElement} {...props} />);

    describe('render', () => {
        test('should return a valid wrapper', () => {
            getWrapper();
            const button = screen.getByRole('button');

            expect(button).toBeInTheDocument();
            expect(button).toHaveClass('bp-SaveVideoFrameToggle');
            expect(button).toHaveAttribute('data-testid', 'bp-save-video-frame-toggle');
        });

        test('should have correct title', () => {
            getWrapper();
            const button = screen.getByRole('button');

            expect(button).toHaveAttribute('title', 'Save Video Frame');
        });

        test('should render download icon', () => {
            getWrapper();
            const icon = screen.getByTestId('IconDownload24');

            expect(icon).toBeInTheDocument();
        });
    });

    describe('event handlers', () => {
        test('should handle click without video element', async () => {
            render(<SaveVideoFrameButton videoElement={null} />);
            const button = screen.getByRole('button');

            // Should not throw an error
            await userEvent.click(button);
            expect(button).toBeInTheDocument();
        });

        test('should handle click with video element', async () => {
            getWrapper();
            const button = screen.getByRole('button');

            // Should not throw an error
            await userEvent.click(button);
            expect(button).toBeInTheDocument();
        });
    });
});
