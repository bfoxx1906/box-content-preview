import React from 'react';

import MediaToggle from './MediaToggle';
import './PictureInPictureToggle.scss';
import IconPictureInPicture24 from '../icons/IconPictureInPicture24';

export type Props = {
    onPictureInPictureToggle?: (isActive: boolean) => void;
    videoElement?: HTMLVideoElement | null;
};

export default function PictureInPictureToggle({ onPictureInPictureToggle, videoElement }: Props): JSX.Element | null {
    const [isPictureInPicture, setIsPictureInPicture] = React.useState(false);

    // Check if Picture-in-Picture is supported
    const isPictureInPictureSupported = React.useMemo(() => {
        return (
            typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled
        );
    }, []);

    // Listen for picture-in-picture events
    React.useEffect(() => {
        if (!videoElement || !isPictureInPictureSupported) {
            return undefined;
        }

        const handleEnterPip = (): void => {
            setIsPictureInPicture(true);
            onPictureInPictureToggle?.(true);
        };

        const handleLeavePip = (): void => {
            setIsPictureInPicture(false);
            onPictureInPictureToggle?.(false);
        };

        videoElement.addEventListener('enterpictureinpicture', handleEnterPip);
        videoElement.addEventListener('leavepictureinpicture', handleLeavePip);

        // Set initial state
        setIsPictureInPicture(document.pictureInPictureElement === videoElement);

        return (): void => {
            videoElement.removeEventListener('enterpictureinpicture', handleEnterPip);
            videoElement.removeEventListener('leavepictureinpicture', handleLeavePip);
        };
    }, [videoElement, isPictureInPictureSupported, onPictureInPictureToggle]);

    const handleClick = async (): Promise<void> => {
        // if (!videoElement || !isPictureInPictureSupported) {
        //     return;
        // }

        try {
            if (isPictureInPicture) {
                await document.exitPictureInPicture();
            } else {
                await videoElement?.requestPictureInPicture();
            }
        } catch (error) {
            // Handle PiP errors gracefully - could be user gesture required, not supported, etc.
            console.warn('Picture-in-Picture error:', error);
        }
    };

    // Don't render if PiP is not supported or no video element
    // if (!isPictureInPictureSupported || !videoElement) {
    //    // return null;
    // }

    const title = isPictureInPicture ? __('exit_picture_in_picture') : __('enter_picture_in_picture');

    return (
        <MediaToggle
            className="bp-PictureInPictureToggle"
            data-testid="bp-picture-in-picture-toggle"
            onClick={handleClick}
            title={title}
        >
            <IconPictureInPicture24 />
        </MediaToggle>
    );
}
