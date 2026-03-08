/**
 * BotFilter – Popup Script
 */

const PLATFORM_LABELS = {
  facebook:  '📘 Facebook – activo en esta pestaña',
  instagram: '📷 Instagram – activo en esta pestaña',
  linkedin:  '💼 LinkedIn – activo en esta pestaña',
  unknown:   'Sitio no compatible'
};

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (_) {
    return null;
  }
}

async function init() {
  // Cargar config guardada
  const stored = await chrome.storage.sync.get(['enabled', 'threshold']);
  const enabled = stored.enabled !== false;
  const threshold = stored.threshold || 3;

  // UI inicial
  document.getElementById('toggleEnabled').checked = enabled;
  document.getElementById('thresholdSlider').value = threshold;
  document.getElementById('sliderVal').textContent = threshold;
  document.getElementById('thresholdDisplay').textContent = threshold;
  if (!enabled) document.body.classList.add('disabled');

  // Obtener stats del content script
  const stats = await sendToContent({ type: 'GET_STATS' });
  if (stats) {
    document.getElementById('hiddenCount').textContent = stats.hiddenCount ?? 0;
    const platform = stats.platform || 'unknown';
    document.getElementById('platformLabel').textContent = PLATFORM_LABELS[platform] || PLATFORM_LABELS.unknown;
    const dot = document.getElementById('platformDot');
    if (platform === 'unknown') dot.classList.add('inactive');
  } else {
    document.getElementById('platformLabel').textContent = 'Sitio no compatible';
    document.getElementById('platformDot').classList.add('inactive');
  }

  // Toggle enabled/disabled
  document.getElementById('toggleEnabled').addEventListener('change', async (e) => {
    const isEnabled = e.target.checked;
    document.body.classList.toggle('disabled', !isEnabled);
    chrome.storage.sync.set({ enabled: isEnabled });
    await sendToContent({ type: 'TOGGLE_ENABLED', enabled: isEnabled });
    if (isEnabled) {
      // Recargar conteo
      setTimeout(async () => {
        const newStats = await sendToContent({ type: 'GET_STATS' });
        if (newStats) document.getElementById('hiddenCount').textContent = newStats.hiddenCount ?? 0;
      }, 800);
    } else {
      document.getElementById('hiddenCount').textContent = 0;
    }
  });

  // Slider de sensibilidad
  const slider = document.getElementById('thresholdSlider');
  slider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('sliderVal').textContent = val;
    document.getElementById('thresholdDisplay').textContent = val;
  });

  slider.addEventListener('change', async (e) => {
    const val = parseFloat(e.target.value);
    chrome.storage.sync.set({ threshold: val });
    await sendToContent({ type: 'SET_THRESHOLD', threshold: val });
  });
}

document.addEventListener('DOMContentLoaded', init);
