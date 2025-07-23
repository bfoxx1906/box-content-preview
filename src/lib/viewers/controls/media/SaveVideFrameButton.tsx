import React from 'react';
import MediaToggle from './MediaToggle';
import IconSaveVideoFrame24 from '../icons/IconSaveVideoFrame24';
import './SaveVideFrameButton.scss';

export type Props = {
    videoElement?: HTMLVideoElement | null;
};

const SaveVideoFrameButton = ({ videoElement }: Props) => {
    const handleClick = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
            if (!videoElement) {
                return;
            }

            try {
                // Create a canvas element to capture the current video frame
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');

                if (!context) {
                    console.error('Could not get canvas 2D context');
                    return;
                }

                // Set canvas dimensions to match video
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;

                // Draw the current video frame to the canvas
                context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

                // Convert canvas to blob
                canvas.toBlob(blob => {
                    if (!blob) {
                        console.error('Failed to create blob from canvas');
                        return;
                    }

                    // Create download URL
                    const blobUrl = URL.createObjectURL(blob);

                    // Create temporary anchor element for download
                    const anchor = document.createElement('a');
                    anchor.href = blobUrl;
                    anchor.download = `video-frame-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
                    anchor.target = '_parent';

                    // Trigger download
                    document.body.appendChild(anchor);
                    anchor.click();
                    document.body.removeChild(anchor);

                    // Clean up blob URL
                    URL.revokeObjectURL(blobUrl);
                }, 'image/png');
            } catch (error) {
                console.error('Error saving video frame:', error);
            }
        },
        [videoElement],
    );

    const title = __('save_video_frame') || 'Save Video Frame';

    return (
        <MediaToggle
            className="bp-SaveVideoFrameToggle"
            data-testid="bp-save-video-frame-toggle"
            onClick={handleClick}
            title={title}
        >
            <IconSaveVideoFrame24 />
        </MediaToggle>
    );
};

export default SaveVideoFrameButton;
