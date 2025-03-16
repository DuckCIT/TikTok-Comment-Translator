document.addEventListener('DOMContentLoaded', () => {
	const languageSelect = document.getElementById('languageSelect');
	const mainHeading = document.getElementById('mainHeading');
	const refreshHint = document.getElementById('refreshHint');
	const copyright = document.getElementById('copyright');
	const sourceLink = document.getElementById('sourceLink');
	const apiInfo = document.getElementById('apiInfo');
	const DEFAULT_LANGUAGE = 'vi';

	let translations = {};
	let originalNames = {};

	fetch(chrome.runtime.getURL('data/languages.json'))
		.then(response => response.json())
		.then(data => {
			translations = data;
			originalNames = Object.keys(data).reduce((acc, lang) => {
				acc[lang] = data[lang].popup.languageNames[lang].split(' (')[0];
				return acc;
			}, {});

			chrome.storage.sync.get(['targetLanguage'], (result) => {
				const savedLanguage = result.targetLanguage || DEFAULT_LANGUAGE;
				languageSelect.value = savedLanguage;
				updateUI(savedLanguage);
			});
		})
		.catch(error => console.error(error));

	function updateUI(language) {
		const trans = translations[language].popup;
		mainHeading.firstChild.nodeValue = trans.mainHeading;
		refreshHint.textContent = trans.refreshHint;
		copyright.textContent = trans.copyright;
		sourceLink.querySelector('a').textContent = trans.sourceLink;
		apiInfo.textContent = trans.apiInfo;

		for (let option of languageSelect.options) {
			const langCode = option.value;
			const originalName = originalNames[langCode];
			const note = trans.languageNames[langCode].includes('(') 
				? trans.languageNames[langCode].split('(')[1].replace(')', '') 
				: '';
			option.textContent = note ? `${originalName} (${note})` : originalName;
		}
	}

	languageSelect.addEventListener('change', () => {
		const selectedLanguage = languageSelect.value;
		chrome.storage.sync.set({ targetLanguage: selectedLanguage }, () => {
			updateUI(selectedLanguage);
		});
	});
});