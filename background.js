// Background script simplificado - Solo maneja clic simple para abrir popup
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Abrir popup de configuración en clic simple
    await chrome.action.setPopup({ popup: 'popup.html' });
    await chrome.action.openPopup();
  } catch (error) {
    console.error('Error opening popup:', error);
  }
});

console.log('Countdown Screensaver - Background service worker initialized');