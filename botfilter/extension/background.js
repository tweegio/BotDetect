/**
 * BotFilter – Background Service Worker
 * Gestiona el badge del ícono y la comunicación entre tabs.
 */

chrome.runtime.onInstalled.addListener(() => {
  // Configuración por defecto al instalar
  chrome.storage.sync.set({
    enabled: true,
    threshold: 3
  });
  console.log('BotFilter instalado correctamente.');
});

// Actualizar badge con el conteo de bots ocultados
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'UPDATE_BADGE') {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const count = message.count;
    const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';

    chrome.action.setBadgeText({ text, tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b', tabId });
    chrome.action.setBadgeTextColor({ color: '#ffffff', tabId });
  }
});
