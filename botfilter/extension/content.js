/**
 * BotFilter – Content Script
 * Detecta y oculta comentarios de bots en Facebook, Instagram y LinkedIn.
 * Arquitectura: Manifest V3 | MutationObserver | Sistema de puntuación heurístico
 */

(function () {
  'use strict';

  // ─── CONFIGURACIÓN ────────────────────────────────────────────────────────
  const CONFIG = {
    SCORE_THRESHOLD: 3,          // Puntuación mínima para marcar como bot
    SCAN_DEBOUNCE_MS: 400,       // Espera antes de escanear nuevos nodos
    MAX_COMMENT_CACHE: 500,      // Límite del caché de comentarios
    VERSION: '1.0.0'
  };

  // ─── FRASES SOSPECHOSAS (base de datos local) ──────────────────────────────
  const BOT_PHRASES = [
    // Genéricas
    'great post', 'amazing content', 'nice article', 'nice post',
    'good post', 'love this', 'awesome post', 'great content',
    'fantastic post', 'wonderful post', 'beautiful post',
    // Spam directo
    'check my profile', 'check out my profile', 'visit my profile',
    'dm me', 'message me', 'contact me for', 'inbox me',
    'earn money fast', 'make money online', 'work from home',
    'passive income', 'financial freedom', 'crypto investment',
    'i made $', 'i earned $', 'join now', 'click the link',
    'link in bio', 'follow me back', 'follow for follow',
    'f4f', 'l4l', 'like for like',
    // Emojis como texto spam
    '🔥🔥🔥', '💯💯💯', '👇👇👇',
    // Otros patrones
    'congratulations you have been selected',
    'you are the lucky winner',
    'claim your prize',
    'limited time offer',
    'act now',
  ];

  // Patrones regex para detección avanzada
  const BOT_PATTERNS = [
    /\bhttps?:\/\/\S+/gi,                          // URLs externas
    /\b\d{1,3}[kK]\+?\s*(followers?|fans?)\b/i,   // "10k followers"
    /\b(bit\.ly|tinyurl|t\.co|goo\.gl)\//i,        // URL shorteners
    /(.)\1{4,}/,                                    // Caracteres repetidos (aaaaa)
    /(\b\w+\b)(\s+\1){2,}/i,                       // Palabras repetidas (hola hola hola)
    /^[^a-záéíóúüñ\w]*$/i,                         // Solo emojis o símbolos
    /💰|💵|💸|🤑/,                                 // Emojis de dinero
  ];

  // ─── ESTADO GLOBAL ────────────────────────────────────────────────────────
  const state = {
    enabled: true,
    hiddenCount: 0,
    processedNodes: new WeakSet(),
    commentTexts: [],           // Para detección de duplicados
    debounceTimer: null,
    platform: detectPlatform()
  };

  // ─── DETECCIÓN DE PLATAFORMA ──────────────────────────────────────────────
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes('facebook.com')) return 'facebook';
    if (host.includes('instagram.com')) return 'instagram';
    if (host.includes('linkedin.com')) return 'linkedin';
    return 'unknown';
  }

  // ─── SELECTORES POR PLATAFORMA ────────────────────────────────────────────
  const SELECTORS = {
    facebook: [
      '[data-testid="UFI2Comment/body"]',
      'div[aria-label*="Comment"] > div',
      'div.x1lliihq span',
      'div[role="article"] div[dir="auto"]',
      'ul[class*="Comment"] li',
      'div[data-commentid]',
    ],
    instagram: [
      'span[class*="_aacl"]',
      'div[class*="C4VMK"] span',
      'div._a9zs span',
      'ul._a9ym li span._aade',
      'div[class*="comment"] span',
    ],
    linkedin: [
      '.comments-comment-item__main-content',
      '.feed-shared-update-v2__commentary',
      '.comment-item .comment-item__body',
      'article.comments-comment-item span.comments-comment-item__main-content',
      'div[class*="comment"] .update-components-text',
    ]
  };

  // ─── SISTEMA DE PUNTUACIÓN ─────────────────────────────────────────────────
  function scoreComment(text) {
    if (!text || text.trim().length === 0) return { score: 0, reasons: [] };

    const lower = text.toLowerCase().trim();
    let score = 0;
    const reasons = [];

    // 1. Frases sospechosas conocidas
    for (const phrase of BOT_PHRASES) {
      if (lower.includes(phrase)) {
        score += 2;
        reasons.push(`Frase spam: "${phrase}"`);
        break; // Un match es suficiente por categoría
      }
    }

    // 2. Patrones regex
    for (const pattern of BOT_PATTERNS) {
      if (pattern.test(text)) {
        score += 1.5;
        reasons.push(`Patrón sospechoso detectado`);
        pattern.lastIndex = 0; // Reset para regex global
      }
    }

    // 3. Comentario muy corto (< 4 palabras) con solo palabras genéricas
    const wordCount = lower.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount <= 3 && /^(nice|great|good|wow|yes|ok|cool|awesome|amazing|lol|haha|😂|❤️|👍)+[\s!.]*$/i.test(lower)) {
      score += 1.5;
      reasons.push('Comentario genérico muy corto');
    }

    // 4. Exceso de signos de exclamación o emojis
    const exclamations = (text.match(/!/g) || []).length;
    const emojiCount = (text.match(/\p{Emoji}/gu) || []).length;
    if (exclamations > 3) { score += 0.5; reasons.push('Exceso de exclamaciones'); }
    if (emojiCount > 5)   { score += 0.5; reasons.push('Exceso de emojis'); }

    // 5. Todo en mayúsculas (> 10 chars)
    if (text.length > 10 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
      score += 1;
      reasons.push('Todo en mayúsculas');
    }

    // 6. Detección de duplicados / similitud
    const similarity = checkSimilarity(lower);
    if (similarity.isDuplicate) {
      score += 3;
      reasons.push('Comentario duplicado o muy similar a otro');
    } else if (similarity.isSimilar) {
      score += 1.5;
      reasons.push('Muy similar a otro comentario ya detectado');
    }

    // Guardar en caché para futuros comparisons
    if (state.commentTexts.length >= CONFIG.MAX_COMMENT_CACHE) {
      state.commentTexts.shift();
    }
    state.commentTexts.push(lower);

    return { score: Math.round(score * 10) / 10, reasons };
  }

  // ─── DETECCIÓN DE SIMILITUD ───────────────────────────────────────────────
  function checkSimilarity(text) {
    const result = { isDuplicate: false, isSimilar: false };
    if (state.commentTexts.length === 0) return result;

    for (const prev of state.commentTexts) {
      if (prev === text) { result.isDuplicate = true; return result; }

      const sim = jaccardSimilarity(text, prev);
      if (sim > 0.85) { result.isDuplicate = true; return result; }
      if (sim > 0.6)  { result.isSimilar = true; }
    }
    return result;
  }

  function jaccardSimilarity(a, b) {
    const setA = new Set(a.split(/\s+/));
    const setB = new Set(b.split(/\s+/));
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  // ─── PROCESAMIENTO DE UN COMENTARIO ──────────────────────────────────────
  function processCommentElement(el) {
    if (state.processedNodes.has(el)) return;
    state.processedNodes.add(el);

    const text = el.innerText || el.textContent || '';
    if (text.trim().length < 2) return;

    const { score, reasons } = scoreComment(text);

    if (score >= CONFIG.SCORE_THRESHOLD) {
      hideComment(el, score, reasons);
    }
  }

  // ─── OCULTAR COMENTARIO ───────────────────────────────────────────────────
  function hideComment(el, score, reasons) {
    // Subir al contenedor padre del comentario para ocultar todo el bloque
    const container = findCommentContainer(el);
    if (!container || container.dataset.botfilterProcessed) return;

    container.dataset.botfilterProcessed = 'true';
    container.classList.add('botfilter-hidden');
    state.hiddenCount++;

    // Crear el marcador de bot
    const marker = document.createElement('div');
    marker.className = 'botfilter-marker';
    marker.innerHTML = `
      <div class="botfilter-marker-inner">
        <div class="botfilter-marker-left">
          <span class="botfilter-icon">🤖</span>
          <div class="botfilter-text">
            <strong>Posible bot/spam detectado</strong>
            <span class="botfilter-score">Puntuación: ${score}/${CONFIG.SCORE_THRESHOLD} • ${reasons[0] || 'Múltiples señales'}</span>
          </div>
        </div>
        <button class="botfilter-show-btn" aria-label="Mostrar comentario oculto">
          Mostrar
        </button>
      </div>
    `;

    // Botón para mostrar el comentario
    marker.querySelector('.botfilter-show-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.remove('botfilter-hidden');
      container.classList.add('botfilter-revealed');
      marker.remove();
      state.hiddenCount = Math.max(0, state.hiddenCount - 1);
      updateBadge();
    });

    container.parentNode.insertBefore(marker, container);
    updateBadge();
  }

  // ─── BUSCAR CONTENEDOR DEL COMENTARIO ────────────────────────────────────
  function findCommentContainer(el) {
    // Sube hasta encontrar un contenedor de comentario lógico
    let node = el;
    for (let i = 0; i < 8; i++) {
      if (!node || !node.parentElement) break;
      node = node.parentElement;
      const role = node.getAttribute?.('role');
      const tag = node.tagName?.toLowerCase();
      // Busca elementos tipo article, li, o con role=article/listitem
      if (
        tag === 'li' ||
        tag === 'article' ||
        role === 'article' ||
        role === 'listitem' ||
        node.dataset?.commentid ||
        (node.className && typeof node.className === 'string' && node.className.includes('comment'))
      ) {
        return node;
      }
    }
    // Si no encontramos un contenedor ideal, usamos el padre directo
    return el.parentElement || el;
  }

  // ─── ESCANEAR NODOS DEL DOM ───────────────────────────────────────────────
  function scanNode(root) {
    if (!state.enabled || !state.platform || state.platform === 'unknown') return;

    const selectors = SELECTORS[state.platform];
    if (!selectors) return;

    for (const selector of selectors) {
      try {
        const elements = root.querySelectorAll
          ? root.querySelectorAll(selector)
          : [];
        elements.forEach(el => processCommentElement(el));
      } catch (_) {
        // Selector inválido en este contexto, ignorar
      }
    }

    // También escanear si el root mismo coincide
    if (root.matches) {
      for (const selector of selectors) {
        try {
          if (root.matches(selector)) processCommentElement(root);
        } catch (_) {}
      }
    }
  }

  // ─── DEBOUNCE SCAN ────────────────────────────────────────────────────────
  function debouncedScan(node) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => scanNode(node), CONFIG.SCAN_DEBOUNCE_MS);
  }

  // ─── MUTATION OBSERVER ────────────────────────────────────────────────────
  const observer = new MutationObserver((mutations) => {
    if (!state.enabled) return;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          debouncedScan(node);
        }
      }
    }
  });

  // ─── BADGE DEL ÍCONO DE EXTENSIÓN ────────────────────────────────────────
  function updateBadge() {
    try {
      chrome.runtime.sendMessage({
        type: 'UPDATE_BADGE',
        count: state.hiddenCount
      });
    } catch (_) {
      // Popup cerrado o contexto invalidado, ignorar
    }
  }

  // ─── COMUNICACIÓN CON POPUP ───────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_STATS':
        sendResponse({
          enabled: state.enabled,
          hiddenCount: state.hiddenCount,
          platform: state.platform
        });
        break;

      case 'TOGGLE_ENABLED':
        state.enabled = message.enabled;
        if (!state.enabled) {
          // Mostrar todos los comentarios ocultados
          document.querySelectorAll('.botfilter-hidden').forEach(el => {
            el.classList.remove('botfilter-hidden');
          });
          document.querySelectorAll('.botfilter-marker').forEach(el => el.remove());
          state.hiddenCount = 0;
          updateBadge();
        } else {
          // Re-escanear la página
          scanNode(document.body);
        }
        sendResponse({ ok: true });
        break;

      case 'SET_THRESHOLD':
        CONFIG.SCORE_THRESHOLD = message.threshold;
        sendResponse({ ok: true });
        break;
    }
    return true; // Para respuestas asíncronas
  });

  // ─── INICIALIZACIÓN ───────────────────────────────────────────────────────
  function init() {
    // Cargar configuración guardada
    chrome.storage.sync.get(['enabled', 'threshold'], (data) => {
      if (data.enabled !== undefined) state.enabled = data.enabled;
      if (data.threshold !== undefined) CONFIG.SCORE_THRESHOLD = data.threshold;

      // Escaneo inicial
      if (state.enabled) {
        // Esperar a que la página cargue comentarios
        setTimeout(() => scanNode(document.body), 1000);
        setTimeout(() => scanNode(document.body), 3000);
      }

      // Iniciar observer
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  // Arrancar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
