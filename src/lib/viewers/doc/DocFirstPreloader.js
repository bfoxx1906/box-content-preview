import EventEmitter from 'events';
import Api from '../../api';
import {
    CLASS_BOX_PREVIEW_PRELOAD,
    CLASS_BOX_PREVIEW_PRELOAD_PLACEHOLDER,
    CLASS_BOX_PREVIEW_PRELOAD_WRAPPER_DOCUMENT,
    CLASS_INVISIBLE,
    CLASS_IS_TRANSPARENT,
    CLASS_PREVIEW_LOADED,
    PDFJS_CSS_UNITS,
    PDFJS_HEIGHT_PADDING_PX,
    PDFJS_MAX_AUTO_SCALE,
    PDFJS_WIDTH_PADDING_PX,
} from '../../constants';
import { setDimensions, handleRepresentationBlobFetch } from '../../util';

const EXIF_COMMENT_TAG_NAME = 'UserComment'; // Read EXIF data from 'UserComment' tag
const EXIF_COMMENT_REGEX = /pdfWidth:([0-9.]+)pts,pdfHeight:([0-9.]+)pts,numPages:([0-9]+)/;

const NUM_PAGES_DEFAULT = 2; // Default to 2 pages for preload if true number of pages cannot be read
const NUM_PAGES_MAX = 20;

const ACCEPTABLE_RATIO_DIFFERENCE = 0.025; // Acceptable difference in ratio of PDF dimensions to image dimensions

class DocFirstPreloader extends EventEmitter {
    /** @property {Api} - Api layer used for XHR calls */
    api = new Api();

    /** @property {HTMLElement} - Viewer container */
    containerEl;

    /** @property {HTMLElement} - Preload image element */
    imageEl;

    /** @property {HTMLElement} - Maximum auto-zoom scale */
    maxZoomScale = PDFJS_MAX_AUTO_SCALE;

    /** @property {Object} - The EXIF data for the PDF */
    pdfData;

    /** @property {HTMLElement} - Preload placeholder element */
    placeholderEl;

    /** @property {HTMLElement} - Preload container element */
    preloadEl;

    /** @property {PreviewUI} - Preview's UI instance */
    previewUI;

    /** @property {string} - Preload representation content URL */
    srcUrl;

    /** @property {string} - Class name for preload wrapper */
    wrapperClassName;

    /** @property {HTMLElement} - Preload wrapper element */
    wrapperEl;

    /** @property {Object} - Preloaded image dimensions */
    imageDimensions;

    loadTime;

    firstImage;

    pageCount = 1;

    preloadedImages = {};

    /**
     * [constructor]
     *
     * @param {PreviewUI} previewUI - UI instance
     * @param {Object} options - Preloader options
     * @param {Api} options.api - API Instance
     * @return {DocPreloader} DocPreloader instance
     */
    constructor(previewUI, { api } = {}) {
        super();
        this.api = api;
        this.previewUI = previewUI;
        this.wrapperClassName = CLASS_BOX_PREVIEW_PRELOAD_WRAPPER_DOCUMENT;
    }

    buildPreloaderImagePlaceHolder(image) {
        const placeHolder = document.createElement('div');
        placeHolder.classList.add(CLASS_BOX_PREVIEW_PRELOAD_PLACEHOLDER);
        placeHolder.appendChild(image);

        return placeHolder;
    }

    async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    /**
     * Shows a preload of the document by showing the first page as an image. This should be called
     * while the full document loads to give the user visual feedback on the file as soon as possible.
     *
     * @param {string} preloadUrlWithAuth - URL for preload content with authorization query params
     * @return {Promise} Promise to show preload
     */
    async showPreload(preloadUrlWithAuth, containerEl, pagedPreLoadUrlWithAuth = '', pages, docBaseViewer) {
        this.containerEl = containerEl;
        this.pageCount = pages;
        // Need to load image as a blob to read EXIF
        this.wrapperEl = document.createElement('div');
        this.wrapperEl.className = this.wrapperClassName;
        this.wrapperEl.classList.add('bp-preloader-loaded');
        this.containerEl.appendChild(this.wrapperEl);

        const promise1 = this.api.get(preloadUrlWithAuth, { type: 'blob' });

        const promises = [promise1];

        const count = pages > 8 ? 8 : pages;

        if (pagedPreLoadUrlWithAuth) {
            for (let i = 2; i <= count; i += 1) {
                const url = pagedPreLoadUrlWithAuth.replace('asset_url', `${i}.png`);
                const promise = this.api.get(url, { type: 'blob' });
                promises.push(promise.catch(e => e));
            }
        }

        this.preloadEl = document.createElement('div');
        this.preloadEl.classList.add(CLASS_BOX_PREVIEW_PRELOAD);
        Promise.all(promises)
            .then(responses => {
                const results = responses.map(response => handleRepresentationBlobFetch(response)); // Assuming the responses are JSON
                return Promise.all(results); // Parse all JSON responses
            })
            .then(async data => {
                this.wrapperEl.appendChild(this.preloadEl);
                let i = 1;
                const first = data.shift();
                this.firstImage = URL.createObjectURL(first);
                this.preloadedImages = {};
                this.preloadedImages[i] = this.firstImage;
                let img = await this.loadImage(this.firstImage);
                let container = this.buildPreloaderImagePlaceHolder(img);
                await this.imageLoadHandler(img, container);
                container = this.buildPreloaderImagePlaceHolder(img);
                container.setAttribute('num', i);
                container.classList.add('loaded');
                this.preloadEl.appendChild(container);
                data.forEach(element => {
                    if (!(element instanceof Error)) {
                        i += 1;
                        img = document.createElement('img');
                        this.preloadedImages[i] = URL.createObjectURL(element);
                        img.src = URL.createObjectURL(element);
                        container = this.buildPreloaderImagePlaceHolder(img);
                        container.setAttribute('num', i);
                        container.classList.add('loaded');
                        this.preloadEl.appendChild(container);
                    }
                });

                docBaseViewer.initThumbnails();
                this.loadTime = Date.now();
            });
    }

    /**
     * Set scaled dimensions for the preload image and show.
     *
     * @param {number} scaledWidth - Width in pixels to scale preload to
     * @param {number} scaledHeight - Height in pixels to scale preload to
     * @param {number} numPages - Number of pages to show for preload
     * @return {void}
     */
    scaleAndShowPreload(scaledWidth, scaledHeight, numPages) {
        if (this.checkDocumentLoaded()) {
            return;
        }

        // Set initial placeholder dimensions
        setDimensions(this.placeholderEl, scaledWidth, scaledHeight);

        // Add and scale correct number of placeholder elements
        for (let i = 0; i < numPages - 1; i += 1) {
            const placeholderEl = document.createElement('div');
            placeholderEl.className = CLASS_BOX_PREVIEW_PRELOAD_PLACEHOLDER;
            setDimensions(placeholderEl, scaledWidth, scaledHeight);
            this.preloadEl.appendChild(placeholderEl);
        }

        // Show preload element after content is properly sized
        this.preloadEl.classList.remove(CLASS_INVISIBLE);

        // Emit message that preload has occurred
        this.emit('preload');
    }

    /**
     * Hides the preload if it exists.
     *
     * @return {void}
     */
    hidePreload() {
        if (!this.wrapperEl) {
            return;
        }

        this.unbindDOMListeners();
        this.restoreScrollPosition();
        this.wrapperEl.classList.add(CLASS_IS_TRANSPARENT);

        // Cleanup preload DOM after fade out
        this.wrapperEl.addEventListener('transitionend', this.cleanupPreload);

        // Cleanup preload DOM immediately if user scrolls after the document is ready since we don't want half-faded
        // out preload content to be on top of real document content while scrolling
        this.wrapperEl.addEventListener('scroll', this.cleanupPreload);
    }

    /**
     * Cleans up preload DOM.
     *
     * @private
     * @return {void}
     */
    cleanupPreload = () => {
        if (this.wrapperEl) {
            this.wrapperEl.style.zIndex = '-11111111';
            this.wrapperEl = undefined;
        }

        this.preloadEl = undefined;
        this.imageEl = undefined;

        if (this.srcUrl) {
            URL.revokeObjectURL(this.srcUrl);
        }
    };

    /**
     * Binds event listeners for preload
     *
     * @private
     * @return {void}
     */
    bindDOMListeners() {
        // this.imageEl.addEventListener('load', this.loadHandler);
    }

    /**
     * Unbinds event listeners for preload
     *
     * @private
     * @return {void}
     */
    unbindDOMListeners() {
        // this.imageEl.removeEventListener('load', this.loadHandler);
    }

    /**
     * Set the real pdf.js document's scroll position to be the same as the preload scroll position.
     *
     * @private
     * @return {void}
     */
    restoreScrollPosition() {
        const { scrollTop } = this.wrapperEl;
        const docEl = this.wrapperEl.parentNode.querySelector('.bp-doc');
        if (docEl && scrollTop > 0) {
            docEl.scrollTop = scrollTop;
        }
    }

    /**
     * Finish preloading by properly scaling preload image to be as close as possible to the
     * true size of the pdf.js document, showing the preload, and hiding the loading indicator.
     *
     * @private
     * @return {Promise} Promise to scale and show preload
     */
    imageLoadHandler = (imageEl, container) => {
        if (!container || !imageEl) {
            return Promise.resolve();
        }

        // Calculate pdf width, height, and number of pages from EXIF if possible
        return this.readEXIF(imageEl)
            .then(pdfData => {
                this.pdfData = pdfData;
                const { scaledWidth, scaledHeight } = this.getScaledWidthAndHeight(pdfData);
                this.wrapperEl.style.width = `${scaledWidth}px`;
                this.imageDimensions = { width: scaledWidth, height: scaledHeight };
                imageEl.classList.add('loaded');
                this.numPages = pdfData.numPages;
                // Otherwise, use the preload image's natural dimensions as a base to scale from
            })
            .catch(() => {
                const { naturalWidth: pdfWidth, naturalHeight: pdfHeight } = imageEl;
                const { scaledWidth, scaledHeight } = this.getScaledDimensions(pdfWidth, pdfHeight);
                this.wrapperEl.style.width = `${scaledWidth}px`;
                this.imageDimensions = { width: scaledWidth, height: scaledHeight };
                imageEl.classList.add('loaded');
            });
    };

    /**
     * Finish preloading by properly scaling preload image to be as close as possible to the
     * true size of the pdf.js document, showing the preload, and hiding the loading indicator.
     *
     * @private
     * @return {Promise} Promise to scale and show preload
     */
    loadHandler = () => {
        if (!this.preloadEl || !this.imageEl) {
            return Promise.resolve();
        }

        // Calculate pdf width, height, and number of pages from EXIF if possible
        return this.readEXIF(this.imageEl)
            .then(pdfData => {
                this.pdfData = pdfData;
                const { scaledWidth, scaledHeight } = this.getScaledWidthAndHeight(pdfData);
                this.scaleAndShowPreload(scaledWidth, scaledHeight, Math.min(pdfData.numPages, NUM_PAGES_MAX));

                // Otherwise, use the preload image's natural dimensions as a base to scale from
            })
            .catch(() => {
                const { naturalWidth: pdfWidth, naturalHeight: pdfHeight } = this.imageEl;
                const { scaledWidth, scaledHeight } = this.getScaledDimensions(pdfWidth, pdfHeight);
                this.scaleAndShowPreload(scaledWidth, scaledHeight, NUM_PAGES_DEFAULT);
            });
    };

    /**
     * Gets the scaled width and height from the EXIF data
     *
     * @param {Object} pdfData - the EXIF data from the image
     * @return {Object} the scaled width and height the
     */
    getScaledWidthAndHeight(pdfData) {
        const { pdfWidth, pdfHeight } = pdfData;
        const { scaledWidth, scaledHeight } = this.getScaledDimensions(pdfWidth, pdfHeight);

        return {
            scaledWidth,
            scaledHeight,
        };
    }

    /**
     * Resizes the preload and placeholder elements
     *
     * @return {void}
     */
    resize() {
        if (!this.preloadEl || (!this.pdfData && !this.imageEl)) {
            return;
        }

        let dimensionData;
        if (this.pdfData) {
            dimensionData = this.getScaledWidthAndHeight(this.pdfData);
        } else {
            const { naturalWidth: pdfWidth, naturalHeight: pdfHeight } = this.imageEl;
            dimensionData = this.getScaledDimensions(pdfWidth, pdfHeight);
        }

        const { scaledWidth, scaledHeight } = dimensionData;
        // Scale preload and placeholder elements
        const preloadEls = this.preloadEl.getElementsByClassName(CLASS_BOX_PREVIEW_PRELOAD_PLACEHOLDER);
        for (let i = 0; i < preloadEls.length; i += 1) {
            setDimensions(preloadEls[i], scaledWidth, scaledHeight);
        }
    }

    /**
     * Returns scaled PDF dimensions using same algorithm as pdf.js up to a maximum of 1.25x zoom.
     *
     * @private
     * @param {number} pdfWidth - Width of PDF in pixels
     * @param {number} pdfHeight - Height of PDF in pixels
     * @return {Object} Scaled width and height in pixels
     */
    getScaledDimensions(pdfWidth, pdfHeight) {
        const { clientWidth, clientHeight } = this.wrapperEl;
        const widthScale = (clientWidth - PDFJS_WIDTH_PADDING_PX) / pdfWidth;
        const heightScale = (clientHeight - PDFJS_HEIGHT_PADDING_PX) / pdfHeight;

        const isLandscape = pdfWidth > pdfHeight;
        let scale = isLandscape ? Math.min(heightScale, widthScale) : widthScale;

        // Optionally limit to maximum zoom scale if defined
        if (this.maxZoomScale) {
            scale = Math.min(this.maxZoomScale, scale);
        }

        return {
            scaledWidth: Math.floor(scale * pdfWidth),
            scaledHeight: Math.floor(scale * pdfHeight),
        };
    }

    /**
     * Reads EXIF from preload JPG for PDF width, height, and numPages. This is currently encoded
     * by Box Conversion into the preload JPG itself, but eventually this information will be
     * available as a property on the preload representation object.
     *
     * @private
     * @param {HTMLElement} imageEl - Preload image element
     * @return {Promise} Promise that resolves with PDF width, PDF height, and num pages
     */
    readEXIF(imageEl) {
        return new Promise((resolve, reject) => {
            try {
                /* global EXIF */
                EXIF.getData(imageEl, () => {
                    const userCommentRaw = EXIF.getTag(imageEl, EXIF_COMMENT_TAG_NAME);
                    const userComment = userCommentRaw.map(c => String.fromCharCode(c)).join('');
                    const match = EXIF_COMMENT_REGEX.exec(userComment);

                    // There should be 3 pieces of metadata: PDF width, PDF height, and num pages
                    if (!match || match.length !== 4) {
                        reject(new Error('No valid EXIF data found'));
                        return;
                    }

                    // Convert PDF Units to CSS Pixels
                    let pdfWidth = parseInt(match[1], 10) * PDFJS_CSS_UNITS;
                    let pdfHeight = parseInt(match[2], 10) * PDFJS_CSS_UNITS;
                    const numPages = parseInt(match[3], 10);

                    // Validate number of pages
                    if (numPages <= 0) {
                        reject(new Error('EXIF num pages data is invalid'));
                        return;
                    }

                    // Validate PDF width and height by comparing ratio to preload image dimension ratio
                    const pdfRatio = pdfWidth / pdfHeight;
                    const imageRatio = imageEl.naturalWidth / imageEl.naturalHeight;

                    if (Math.abs(pdfRatio - imageRatio) > ACCEPTABLE_RATIO_DIFFERENCE) {
                        const rotatedPdfRatio = pdfHeight / pdfWidth;

                        // Check if ratio is valid after height and width are swapped since PDF may be rotated
                        if (Math.abs(rotatedPdfRatio - imageRatio) > ACCEPTABLE_RATIO_DIFFERENCE) {
                            reject(new Error('EXIF PDF width and height are invalid'));
                            return;
                        }

                        // Swap PDF width and height if swapped ratio seems correct
                        const tempWidth = pdfWidth;
                        pdfWidth = pdfHeight;
                        pdfHeight = tempWidth;
                    }

                    // Resolve with valid PDF width, height, and num pages
                    resolve({
                        pdfWidth,
                        pdfHeight,
                        numPages,
                    });
                });
            } catch (e) {
                reject(new Error('Error reading EXIF data'));
            }
        });
    }

    /**
     * Check if full document is already loaded - if so, hide the preload.
     *
     * @private
     * @return {boolean} Whether document is already loaded
     */
    checkDocumentLoaded() {
        // If document is already loaded, hide the preload and short circuit
        if (this.previewUI.previewContainer.classList.contains(CLASS_PREVIEW_LOADED)) {
            this.hidePreload();
            return true;
        }

        return false;
    }
}

export default DocFirstPreloader;
