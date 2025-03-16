// content.js
const BUTTON_TEXT_MAP = {
    vi: { translate: 'Xem bản dịch', original: 'Xem bản gốc', translating: 'Đang dịch...' },
    en: { translate: 'View translation', original: 'View original', translating: 'Translating...' },
    zh: { translate: '查看翻译', original: '查看原文', translating: '翻译中...' },
    hi: { translate: 'अनुवाद देखें', original: 'मूल देखें', translating: 'अनुवाद हो रहा है...' },
    es: { translate: 'Ver traducción', original: 'Ver original', translating: 'Traduciendo...' },
    fr: { translate: 'Voir la traduction', original: 'Voir l’original', translating: 'Traduction...' },
};

// Hằng số cố định để dễ thay đổi sau này
const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';
const MAX_TEXT_LENGTH = 4000; // Giới hạn ký tự cho mỗi yêu cầu API
const DETECT_LANGUAGE_LIMIT = 100; // Số ký tự tối đa để phát hiện ngôn ngữ

// Bộ nhớ đệm lưu trữ các bản dịch đã thực hiện (tối ưu hiệu suất)
const translationCache = new Map();

/**
 * Dịch văn bản bằng Google Translate API, hỗ trợ cả văn bản dài
 * @param {string} text - Văn bản cần dịch
 * @param {string} targetLanguage - Ngôn ngữ đích (ví dụ: 'vi', 'en')
 * @returns {Promise<string>} - Văn bản đã dịch
 */
async function translateText(text, targetLanguage) {
    const cacheKey = `${text}-${targetLanguage}`;
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

    // Làm sạch chuỗi trước khi mã hóa
    const cleanText = text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}]/gu, ''); // Loại bỏ ký tự không hợp lệ

    // Dịch văn bản ngắn (< MAX_TEXT_LENGTH)
    if (cleanText.length <= MAX_TEXT_LENGTH) {
        try {
            const response = await fetch(
                `${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(cleanText)}`
            );
            if (!response.ok) throw new Error('API không phản hồi');
            const data = await response.json();
            if (!data || !data[0]) throw new Error('Dữ liệu trả về không hợp lệ');
            const translatedText = data[0].map(item => item[0]).join('');
            translationCache.set(cacheKey, translatedText);
            return translatedText;
        } catch (error) {
            throw error;
        }
    }

    // Dịch văn bản dài bằng cách chia nhỏ
    const chunks = [];
    for (let i = 0; i < cleanText.length; i += MAX_TEXT_LENGTH) {
        chunks.push(cleanText.slice(i, i + MAX_TEXT_LENGTH));
    }

    const translatedChunks = await Promise.all(
        chunks.map(async (chunk) => {
            const response = await fetch(
                `${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(chunk)}`
            );
            if (!response.ok) throw new Error('API không phản hồi');
            const data = await response.json();
            return data[0].map(item => item[0]).join('');
        })
    );

    const translatedText = translatedChunks.join(' ');
    translationCache.set(cacheKey, translatedText);
    return translatedText;
}

/**
 * Thêm nút dịch vào bình luận
 * @param {HTMLElement} comment - Phần tử bình luận (data-e2e^="comment-level-")
 * @param {HTMLElement} container - Phần tử chứa nút dịch
 * @param {HTMLElement} commentTextElement - Phần tử chứa nội dung bình luận
 * @param {string} originalText - Văn bản gốc của bình luận
 * @param {string} targetLanguage - Ngôn ngữ đích
 */
async function addTranslateButton(comment, container, commentTextElement, originalText, targetLanguage) {
    if (!originalText || comment.dataset.translateButtonAdded) return;

    try {
        // Lấy văn bản nút theo ngôn ngữ, mặc định là 'vi'
        const texts = BUTTON_TEXT_MAP[targetLanguage] || BUTTON_TEXT_MAP.vi;

        // Kiểm tra ngôn ngữ nguồn bằng 100 ký tự đầu
        let detectedLang = null;
        try {
            const cleanText = originalText.slice(0, DETECT_LANGUAGE_LIMIT).replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}]/gu, '');
            const response = await fetch(
                `${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(cleanText)}`
            );
            if (!response.ok) throw new Error('API không phản hồi');
            const data = await response.json();
            detectedLang = data[2];
        } catch (error) {
            console.warn('Không thể phát hiện ngôn ngữ:', error);
        }

        // Nếu không phát hiện được ngôn ngữ hoặc ngôn ngữ khác targetLanguage, vẫn thêm nút
        if (detectedLang === targetLanguage) return;

        // Tạo nút dịch
        const translateButton = document.createElement('span');
        translateButton.innerText = texts.translate;
        translateButton.classList.add('translate-button');
        translateButton.style.cursor = 'pointer';

        // Đánh dấu bình luận đã được xử lý
        comment.dataset.translateButtonAdded = 'true';

        // Tùy chỉnh style theo loại container
        const isObjectWrapper = container.closest('[class*="DivCommentObjectWrapper"]');
        if (isObjectWrapper) {
            translateButton.classList.add('TUXText--tiktok-sans', 'TUXText--weight-medium');
            translateButton.style.color = 'var(--ui-text-3)';
        } else {
            translateButton.classList.add('css-cpmlpt-SpanReplyButton');
            translateButton.style.marginLeft = '10px';
        }

        // Chèn nút vào DOM
        const replyButton = container.querySelector('[data-e2e^="comment-reply-"]');
        if (replyButton) {
            replyButton.insertAdjacentElement('afterend', translateButton);
        } else {
            container.appendChild(translateButton);
        }

        // Xử lý sự kiện click để dịch/xem gốc
        let isTranslated = false;
        translateButton.addEventListener('click', async () => {
            if (!isTranslated) {
                translateButton.innerText = texts.translating;
                try {
                    const translatedText = await translateText(originalText, targetLanguage);
                    commentTextElement.textContent = translatedText;
                    translateButton.innerText = texts.original;
                    isTranslated = true;
                } catch (error) {
                    console.error('Lỗi dịch:', error);
                    commentTextElement.textContent = 'Lỗi dịch văn bản';
                    translateButton.innerText = texts.translate;
                }
            } else {
                commentTextElement.textContent = originalText;
                translateButton.innerText = texts.translate;
                isTranslated = false;
            }
        });
    } catch (error) {
        console.error('Lỗi khởi tạo nút dịch:', error);
    }
}

/**
 * Xử lý tất cả bình luận hiện có trên trang
 * @param {string} targetLanguage - Ngôn ngữ đích
 */
function processExistingComments(targetLanguage) {
    document.querySelectorAll('[data-e2e^="comment-level-"]').forEach((comment) => {
        if (!comment.dataset.translateButtonAdded) {
            const container = comment.closest('div').querySelector('[data-e2e^="comment-reply-"]')?.parentElement || comment.closest('div');
            if (container) {
                const commentTextElement = comment.querySelector('span, p') || comment;
                const originalText = commentTextElement.textContent.trim();
                addTranslateButton(comment, container, commentTextElement, originalText, targetLanguage);
            }
        }
    });
}

/**
 * Theo dõi thay đổi DOM để thêm nút dịch cho bình luận mới
 * @param {string} targetLanguage - Ngôn ngữ đích
 */
function startObserver(targetLanguage) {
    const processedComments = new WeakSet(); // Theo dõi các bình luận đã xử lý
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        node.querySelectorAll('[data-e2e^="comment-level-"]').forEach((comment) => {
                            if (!comment.dataset.translateButtonAdded && !processedComments.has(comment)) {
                                const container = comment.closest('div').querySelector('[data-e2e^="comment-reply-"]')?.parentElement || comment.closest('div');
                                if (container) {
                                    const commentTextElement = comment.querySelector('span, p') || comment;
                                    const originalText = commentTextElement.textContent.trim();
                                    addTranslateButton(comment, container, commentTextElement, originalText, targetLanguage);
                                    processedComments.add(comment); // Đánh dấu đã xử lý
                                }
                            }
                        });
                    }
                });
            }
        });
    });

    // Chọn vùng theo dõi (ưu tiên vùng bình luận, fallback về body)
    const commentSection =
        document.querySelector('[class*="DivCommentItemContainer"]') ||
        document.querySelector('[class*="DivCommentObjectWrapper"]') ||
        document.body;
    observer.observe(commentSection, {
        childList: true,
        subtree: true
    });
}

// Khởi chạy extension: Lấy ngôn ngữ từ storage và bắt đầu xử lý
chrome.storage.sync.get(['targetLanguage'], (result) => {
    const targetLanguage = result.targetLanguage || 'vi'; // Mặc định 'vi' nếu không có
    processExistingComments(targetLanguage);
    startObserver(targetLanguage);
});