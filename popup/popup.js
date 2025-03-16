document.addEventListener('DOMContentLoaded', () => {
	// Lấy phần tử select từ DOM
	const languageSelect = document.getElementById('languageSelect');
	const DEFAULT_LANGUAGE = 'vi'; // Ngôn ngữ mặc định nếu không có giá trị lưu trữ

	/**
	 * Khôi phục ngôn ngữ đã lưu từ chrome.storage
	 * Nếu không có, đặt mặc định là 'vi'
	 */
	chrome.storage.sync.get(['targetLanguage'], (result) => {
		const savedLanguage = result.targetLanguage || DEFAULT_LANGUAGE;
		languageSelect.value = savedLanguage;
		console.log('Ngôn ngữ đã khôi phục:', savedLanguage);
	});

	/**
	 * Lưu ngôn ngữ mới khi người dùng thay đổi lựa chọn
	 */
	languageSelect.addEventListener('change', () => {
		const selectedLanguage = languageSelect.value;
		chrome.storage.sync.set({
			targetLanguage: selectedLanguage
		}, () => {
			console.log('Ngôn ngữ đã được lưu:', selectedLanguage);
		});
	});
});