import * as React from 'react';

function IconSaveVideoFrame24(props: React.SVGProps<SVGSVGElement>): JSX.Element {
    return (
        <svg
            {...props}
            data-testid="IconDownload24"
            fill="#fff"
            focusable={false}
            height={24}
            viewBox="0 0 24 24"
            width={24}
        >
            {/* Monitor/Screen frame */}
            <path d="M20 3H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H4V5h16v10z" />
            {/* Download arrow */}
            <path d="M12 8l-3 3h2v3h2v-3h2l-3-3z" />
            {/* Base line */}
            <path d="M8 16h8v1H8v-1z" />
        </svg>
    );
}

export default IconSaveVideoFrame24;
