const GOOGLE_TRANSLATE_API = 'https://translate.googleapis.com/translate_a/single';
const MAX_TEXT_LENGTH = 4000;
const DETECT_LANGUAGE_LIMIT = 100;
const translationCache = new Map();

let translations = {};

fetch(chrome.runtime.getURL('data/languages.json'))
	.then(response => response.json())
	.then(data => {
		translations = data;
		chrome.storage.sync.get(['targetLanguage'], (result) => {
			const targetLanguage = result.targetLanguage || 'vi';
			processExistingComments(targetLanguage);
			startObserver(targetLanguage);
		});
	})
	.catch(error => console.error(error));

async function translateText(text, targetLanguage) {
	const cacheKey = `${text}-${targetLanguage}`;
	if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

	const cleanText = text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}]/gu, '');
	const lines = cleanText.split('\n');
	const errors = translations[targetLanguage]?.content.errors || translations.vi.content.errors;

	if (cleanText.length <= MAX_TEXT_LENGTH) {
		try {
			const response = await fetch(
				`${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(cleanText)}`
			);
			if (!response.ok) throw new Error(errors.apiError);
			const data = await response.json();
			if (!data || !data[0]) throw new Error(errors.invalidData);
			const translatedText = data[0].map(item => item[0]).join('');
			translationCache.set(cacheKey, translatedText);
			return translatedText;
		} catch (error) {
			console.error(errors.translateError, error);
			throw error;
		}
	}

	const translatedLines = await Promise.all(
		lines.map(async (line) => {
			if (!line.trim()) return '';
			const response = await fetch(
				`${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(line)}`
			);
			if (!response.ok) throw new Error(errors.apiError);
			const data = await response.json();
			return data[0].map(item => item[0]).join('');
		})
	);

	const translatedText = translatedLines.join('\n');
	translationCache.set(cacheKey, translatedText);
	return translatedText;
}

async function addTranslateButton(comment, container, commentTextElement, originalText, targetLanguage) {
	if (!originalText || comment.dataset.translateButtonAdded) return;

	const texts = translations[targetLanguage]?.content || translations.vi.content;
	const errors = translations[targetLanguage]?.content.errors || translations.vi.content.errors;
	const originalLines = commentTextElement.textContent.split('\n');

	let detectedLang = null;
	try {
		const cleanText = originalText.slice(0, DETECT_LANGUAGE_LIMIT).replace(/[^\p{L}\p{N}\p{P}\p{Z}\p{S}]/gu, '');
		const response = await fetch(
			`${GOOGLE_TRANSLATE_API}?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(cleanText)}`
		);
		if (!response.ok) throw new Error(errors.apiError);
		const data = await response.json();
		detectedLang = data[2];
	} catch (error) {
		console.warn(errors.langDetectError, error);
	}

	if (detectedLang === targetLanguage) return;

	const translateButton = document.createElement('span');
	translateButton.innerText = texts.translate;
	translateButton.classList.add('translate-button');
	translateButton.style.cursor = 'pointer';
	comment.dataset.translateButtonAdded = 'true';

	const isObjectWrapper = container.closest('[class*="DivCommentObjectWrapper"]');
	if (isObjectWrapper) {
		translateButton.classList.add('TUXText--tiktok-sans', 'TUXText--weight-medium');
		translateButton.style.color = 'var(--ui-text-3)';
	} else {
		translateButton.classList.add('css-cpmlpt-SpanReplyButton');
		translateButton.style.marginLeft = '10px';
	}

	const replyButton = container.querySelector('[data-e2e^="comment-reply-"]');
	if (replyButton) {
		replyButton.insertAdjacentElement('afterend', translateButton);
	} else {
		container.appendChild(translateButton);
	}

	let isTranslated = false;
	translateButton.addEventListener('click', async () => {
		if (!isTranslated) {
			translateButton.innerText = texts.translating;
			try {
				const translatedText = await translateText(originalText, targetLanguage);
				commentTextElement.innerHTML = translatedText.replace(/\n/g, '<br>');
				translateButton.innerText = texts.original;
				isTranslated = true;
			} catch (error) {
				console.error(errors.translateError, error);
				commentTextElement.innerHTML = errors.translateError;
				translateButton.innerText = texts.translate;
			}
		} else {
			commentTextElement.innerHTML = originalLines.join('<br>');
			translateButton.innerText = texts.translate;
			isTranslated = false;
		}
	});
}

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

function startObserver(targetLanguage) {
	const processedComments = new WeakSet();
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
									processedComments.add(comment);
								}
							}
						});
					}
				});
			}
		});
	});

	const commentSection =
		document.querySelector('[class*="DivCommentItemContainer"]') ||
		document.querySelector('[class*="DivCommentObjectWrapper"]') ||
		document.body;
	observer.observe(commentSection, {
		childList: true,
		subtree: true
	});
}