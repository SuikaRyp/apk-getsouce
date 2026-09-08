/**
 * RSOURCE — Professional Website Source Code Extractor
 * Direct Browser Redirect & Real ZIP Download Engine
 * Clean Code - No Emojis - No Parentheses
 */

// State Management
const state = {
  targetUrl: '',
  parsedDomain: '',
  htmlRaw: '',
  htmlFormatted: '',
  title: '',
  metadata: {},
  scripts: [], // { type: 'inline'|'external', url: string, content: string, name: string, fetched: boolean }
  styles: [],   // { type: 'inline'|'external', url: string, content: string, name: string, fetched: boolean }
  media: [],    // { type: 'img'|'svg'|'icon', url: string, name: string }
  linksCount: 0,
  activeJsIndex: 0,
  activeCssIndex: 0,
  isFetching: false,
  wrapLines: false
};

// UI Cache
const elements = {
  fetchForm: document.getElementById('fetchForm'),
  urlInput: document.getElementById('urlInput'),
  btnFetch: document.getElementById('btnFetch'),
  btnPaste: document.getElementById('btnPaste'),
  btnClear: document.getElementById('btnClear'),
  proxySelect: document.getElementById('proxySelect'),
  statusBanner: document.getElementById('statusBanner'),
  statusMessage: document.getElementById('statusMessage'),
  statusIcon: document.getElementById('statusIcon'),
  statusTags: document.getElementById('statusTags'),
  inspectorCard: document.getElementById('inspectorCard'),
  toastContainer: document.getElementById('toastContainer'),
  
  // Tabs
  tabBtns: document.querySelectorAll('.tab-item'),
  tabContents: document.querySelectorAll('.tab-pane'),
  
  // Stats
  badgeHtml: document.getElementById('badgeHtml'),
  badgeScripts: document.getElementById('badgeScripts'),
  badgeStyles: document.getElementById('badgeStyles'),
  badgeMedia: document.getElementById('badgeMedia'),
  statHtmlSize: document.getElementById('statHtmlSize'),
  statJsCount: document.getElementById('statJsCount'),
  statCssCount: document.getElementById('statCssCount'),
  statMediaCount: document.getElementById('statMediaCount'),
  
  // Metadata
  metaUrl: document.getElementById('metaUrl'),
  metaTitle: document.getElementById('metaTitle'),
  metaDescription: document.getElementById('metaDescription'),
  metaFavicon: document.getElementById('metaFavicon'),
  metaLinksCount: document.getElementById('metaLinksCount'),
  
  // Code Viewers
  htmlCodeViewer: document.getElementById('htmlCodeViewer'),
  htmlCodeContainer: document.getElementById('htmlCodeContainer'),
  jsListContainer: document.getElementById('jsListContainer'),
  jsCodeViewer: document.getElementById('jsCodeViewer'),
  jsSelectedTitle: document.getElementById('jsSelectedTitle'),
  cssListContainer: document.getElementById('cssListContainer'),
  cssCodeViewer: document.getElementById('cssCodeViewer'),
  cssSelectedTitle: document.getElementById('cssSelectedTitle'),
  assetGridContainer: document.getElementById('assetGridContainer'),
  previewIframe: document.getElementById('previewIframe'),
  iframeBox: document.getElementById('iframeBox'),
  
  // Action Buttons
  btnQuickZip: document.getElementById('btnQuickZip'),
  btnQuickCopyHtml: document.getElementById('btnQuickCopyHtml'),
  btnFormatHtml: document.getElementById('btnFormatHtml'),
  btnToggleWrapHtml: document.getElementById('btnToggleWrapHtml'),
  btnCopyHtml: document.getElementById('btnCopyHtml'),
  btnDownloadHtml: document.getElementById('btnDownloadHtml'),
  btnFormatJs: document.getElementById('btnFormatJs'),
  btnCopyJs: document.getElementById('btnCopyJs'),
  btnDownloadJs: document.getElementById('btnDownloadJs'),
  btnFormatCss: document.getElementById('btnFormatCss'),
  btnCopyCss: document.getElementById('btnCopyCss'),
  btnDownloadCss: document.getElementById('btnDownloadCss'),
  btnRefreshFrame: document.getElementById('btnRefreshFrame'),
  btnOpenNewTab: document.getElementById('btnOpenNewTab'),
  btnDownloadZipFull: document.getElementById('btnDownloadZipFull'),
  btnDlHtmlOnly: document.getElementById('btnDlHtmlOnly'),
  btnDlJsBundle: document.getElementById('btnDlJsBundle'),
  btnDlCssBundle: document.getElementById('btnDlCssBundle'),
  searchHtmlInput: document.getElementById('searchHtml')
};

// Haptic feedback
async function triggerHaptic() {
  try {
    if (window.Capacitor && window.Capacitor.isPluginAvailable("Haptics")) {
      await window.Capacitor.Plugins.Haptics.impact({ style: "LIGHT" });
    }
  } catch (e) {}
}

// Toast notification without emojis
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-triangle';
  
  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Format Bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Normalize URL
function normalizeUrl(input) {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

// Resolve relative URL
function resolveAbsoluteUrl(relative, base) {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return relative;
  }
}

// Proxy Fetcher
async function fetchWithProxy(targetUrl, selectedProxy) {
  const startTime = performance.now();

  if (window.Capacitor && window.Capacitor.isPluginAvailable("CapacitorHttp")) {
    try {
      const response = await window.Capacitor.Plugins.CapacitorHttp.get({ url: targetUrl });
      const duration = Math.round(performance.now() - startTime);
      return { html: response.data, status: response.status || 200, duration, proxyUsed: 'Capacitor Native Http' };
    } catch (err) {
      console.warn("CapacitorHttp fallback to web proxy", err);
    }
  }

  const proxyList = [];
  if (selectedProxy === 'allorigins') {
    proxyList.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`);
  } else if (selectedProxy === 'corsproxy') {
    proxyList.push(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`);
  } else if (selectedProxy === 'codetabs') {
    proxyList.push(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`);
  } else if (selectedProxy === 'direct') {
    proxyList.push(targetUrl);
  } else {
    proxyList.push(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
      targetUrl
    );
  }

  let lastError = null;
  for (const url of proxyList) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml' } });
      if (res.ok) {
        const text = await res.text();
        const duration = Math.round(performance.now() - startTime);
        return { html: text, status: res.status, duration, proxyUsed: url };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(lastError ? lastError.message : 'Failed to fetch URL through proxies.');
}

// MAIN EXTRACTION
async function extractWebsiteSource(rawUrl) {
  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    showToast('Please enter a valid website URL', 'error');
    return;
  }

  state.targetUrl = targetUrl;
  try {
    state.parsedDomain = new URL(targetUrl).hostname;
  } catch (e) {
    state.parsedDomain = 'website';
  }

  state.isFetching = true;
  elements.btnFetch.disabled = true;
  elements.btnFetch.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Extracting...</span>';
  
  elements.statusBanner.className = 'status-banner loading';
  elements.statusIcon.className = 'fa-solid fa-circle-notch fa-spin';
  elements.statusMessage.innerText = `Extracting source code from ${state.parsedDomain}...`;
  elements.statusTags.innerHTML = '';

  triggerHaptic();

  try {
    const selectedProxy = elements.proxySelect.value;
    const fetchResult = await fetchWithProxy(targetUrl, selectedProxy);
    
    state.htmlRaw = fetchResult.html;

    const parser = new DOMParser();
    const doc = parser.parseFromString(state.htmlRaw, 'text/html');

    state.title = doc.title || state.parsedDomain;

    state.metadata = {
      description: doc.querySelector('meta[name="description"]')?.content || doc.querySelector('meta[property="og:description"]')?.content || 'No meta description found.',
      keywords: doc.querySelector('meta[name="keywords"]')?.content || '-',
      ogImage: doc.querySelector('meta[property="og:image"]')?.content || '',
      favicon: doc.querySelector('link[rel*="icon"]')?.href || resolveAbsoluteUrl('/favicon.ico', targetUrl)
    };

    state.linksCount = doc.querySelectorAll('a[href]').length;

    // Extract Scripts
    state.scripts = [];
    const scriptElements = doc.querySelectorAll('script');
    let inlineJsCount = 0;
    
    for (let i = 0; i < scriptElements.length; i++) {
      const el = scriptElements[i];
      const src = el.getAttribute('src');
      if (src) {
        const absSrc = resolveAbsoluteUrl(src, targetUrl);
        const fileName = absSrc.split('/').pop().split('?')[0] || `script_${i + 1}.js`;
        state.scripts.push({
          type: 'external',
          url: absSrc,
          name: fileName,
          content: `// External Script URL: ${absSrc}\n// Click tab to fetch contents.`,
          fetched: false
        });
      } else if (el.textContent.trim()) {
        inlineJsCount++;
        state.scripts.push({
          type: 'inline',
          url: '',
          name: `Inline Script ${inlineJsCount}`,
          content: el.textContent.trim(),
          fetched: true
        });
      }
    }

    // Extract Styles
    state.styles = [];
    const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
    const styleElements = doc.querySelectorAll('style');
    let inlineCssCount = 0;

    for (let i = 0; i < linkElements.length; i++) {
      const href = linkElements[i].getAttribute('href');
      if (href) {
        const absHref = resolveAbsoluteUrl(href, targetUrl);
        const fileName = absHref.split('/').pop().split('?')[0] || `style_${i + 1}.css`;
        state.styles.push({
          type: 'external',
          url: absHref,
          name: fileName,
          content: `/* External Stylesheet URL: ${absHref} */`,
          fetched: false
        });
      }
    }

    for (let i = 0; i < styleElements.length; i++) {
      if (styleElements[i].textContent.trim()) {
        inlineCssCount++;
        state.styles.push({
          type: 'inline',
          url: '',
          name: `Inline Style ${inlineCssCount}`,
          content: styleElements[i].textContent.trim(),
          fetched: true
        });
      }
    }

    // Extract Media
    state.media = [];
    const imgElements = doc.querySelectorAll('img[src]');
    imgElements.forEach((img, idx) => {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const absUrl = resolveAbsoluteUrl(src, targetUrl);
        const name = absUrl.split('/').pop().split('?')[0] || `image_${idx + 1}`;
        state.media.push({ type: 'img', url: absUrl, name });
      }
    });

    const svgElements = doc.querySelectorAll('svg');
    svgElements.forEach((svg, idx) => {
      state.media.push({ type: 'svg', url: '#svg', name: `Inline SVG ${idx + 1}` });
    });

    if (state.metadata.favicon) {
      state.media.unshift({ type: 'icon', url: state.metadata.favicon, name: 'Favicon Icon' });
    }

    elements.statusBanner.className = 'status-banner success';
    elements.statusIcon.className = 'fa-solid fa-circle-check';
    elements.statusMessage.innerText = `Extracted ${state.parsedDomain} successfully.`;
    elements.statusTags.innerHTML = `
      <span class="status-tag">Status 200 OK</span>
      <span class="status-tag">${fetchResult.duration} ms</span>
      <span class="status-tag">${formatBytes(state.htmlRaw.length)}</span>
    `;

    if (window.html_beautify) {
      state.htmlFormatted = window.html_beautify(state.htmlRaw, { indent_size: 2 });
    } else {
      state.htmlFormatted = state.htmlRaw;
    }

    renderOverviewTab();
    renderHtmlTab();
    renderScriptsTab();
    renderStylesTab();
    renderMediaTab();
    renderLivePreview();

    elements.inspectorCard.classList.add('active');
    elements.inspectorCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showToast(`Source code ${state.parsedDomain} extracted successfully`, 'success');

  } catch (error) {
    console.error("Extraction error:", error);
    elements.statusBanner.className = 'status-banner error';
    elements.statusIcon.className = 'fa-solid fa-circle-exclamation';
    elements.statusMessage.innerText = `Extraction failed: ${error.message}`;
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    state.isFetching = false;
    elements.btnFetch.disabled = false;
    elements.btnFetch.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Extract Source</span>';
  }
}

// RENDER OVERVIEW
function renderOverviewTab() {
  elements.badgeHtml.innerText = formatBytes(state.htmlRaw.length);
  elements.badgeScripts.innerText = state.scripts.length;
  elements.badgeStyles.innerText = state.styles.length;
  elements.badgeMedia.innerText = state.media.length;

  elements.statHtmlSize.innerText = formatBytes(state.htmlRaw.length);
  elements.statJsCount.innerText = `${state.scripts.length} File`;
  elements.statCssCount.innerText = `${state.styles.length} File`;
  elements.statMediaCount.innerText = `${state.media.length} Asset`;

  elements.metaUrl.innerText = state.targetUrl;
  elements.metaTitle.innerText = state.title;
  elements.metaDescription.innerText = state.metadata.description;
  elements.metaFavicon.innerText = state.metadata.favicon;
  elements.metaLinksCount.innerText = `${state.linksCount} links detected`;
}

// RENDER HTML
function renderHtmlTab() {
  elements.htmlCodeViewer.textContent = state.htmlFormatted;
  if (window.Prism) {
    Prism.highlightElement(elements.htmlCodeViewer);
  }
}

// RENDER SCRIPTS
function renderScriptsTab() {
  elements.jsListContainer.innerHTML = '';
  
  if (state.scripts.length === 0) {
    elements.jsListContainer.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); padding:10px;">No scripts detected.</p>';
    elements.jsCodeViewer.textContent = '// No JS files found';
    return;
  }

  state.scripts.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `resource-item ${idx === state.activeJsIndex ? 'active' : ''}`;
    div.innerHTML = `
      <span>${item.name}</span>
      <div class="meta">
        <span>${item.type === 'inline' ? 'Inline Script' : 'External JS'}</span>
        <span>${item.type === 'inline' ? formatBytes(item.content.length) : 'Fetch on click'}</span>
      </div>
    `;
    div.addEventListener('click', () => selectJsScript(idx));
    elements.jsListContainer.appendChild(div);
  });

  selectJsScript(state.activeJsIndex || 0);
}

async function selectJsScript(index) {
  state.activeJsIndex = index;
  const item = state.scripts[index];
  if (!item) return;

  const items = elements.jsListContainer.querySelectorAll('.resource-item');
  items.forEach((el, idx) => el.classList.toggle('active', idx === index));

  elements.jsSelectedTitle.innerText = item.name;

  if (item.type === 'external' && !item.fetched) {
    elements.jsCodeViewer.textContent = `// Fetching contents from ${item.url}...`;
    try {
      const res = await fetchWithProxy(item.url, elements.proxySelect.value);
      item.content = res.html;
      item.fetched = true;
    } catch (e) {
      item.content = `// Failed to fetch external JS: ${e.message}\n// URL: ${item.url}`;
    }
  }

  elements.jsCodeViewer.textContent = item.content;
  if (window.Prism) {
    Prism.highlightElement(elements.jsCodeViewer);
  }
}

// RENDER STYLES
function renderStylesTab() {
  elements.cssListContainer.innerHTML = '';

  if (state.styles.length === 0) {
    elements.cssListContainer.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); padding:10px;">No stylesheets detected.</p>';
    elements.cssCodeViewer.textContent = '/* No CSS files found */';
    return;
  }

  state.styles.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = `resource-item ${idx === state.activeCssIndex ? 'active' : ''}`;
    div.innerHTML = `
      <span>${item.name}</span>
      <div class="meta">
        <span>${item.type === 'inline' ? 'Inline Style' : 'External CSS'}</span>
        <span>${item.type === 'inline' ? formatBytes(item.content.length) : 'Fetch on click'}</span>
      </div>
    `;
    div.addEventListener('click', () => selectCssStyle(idx));
    elements.cssListContainer.appendChild(div);
  });

  selectCssStyle(state.activeCssIndex || 0);
}

async function selectCssStyle(index) {
  state.activeCssIndex = index;
  const item = state.styles[index];
  if (!item) return;

  const items = elements.cssListContainer.querySelectorAll('.resource-item');
  items.forEach((el, idx) => el.classList.toggle('active', idx === index));

  elements.cssSelectedTitle.innerText = item.name;

  if (item.type === 'external' && !item.fetched) {
    elements.cssCodeViewer.textContent = `/* Fetching contents from ${item.url}... */`;
    try {
      const res = await fetchWithProxy(item.url, elements.proxySelect.value);
      item.content = res.html;
      item.fetched = true;
    } catch (e) {
      item.content = `/* Failed to fetch external CSS: ${e.message}\n * URL: ${item.url}\n */`;
    }
  }

  elements.cssCodeViewer.textContent = item.content;
  if (window.Prism) {
    Prism.highlightElement(elements.cssCodeViewer);
  }
}

// RENDER MEDIA
function renderMediaTab(filter = 'all') {
  elements.assetGridContainer.innerHTML = '';

  const filteredMedia = state.media.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'img') return item.type === 'img';
    if (filter === 'svg') return item.type === 'svg';
    if (filter === 'icon') return item.type === 'icon';
    return true;
  });

  if (filteredMedia.length === 0) {
    elements.assetGridContainer.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); padding:20px;">No media assets found.</p>';
    return;
  }

  filteredMedia.forEach(item => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    
    let previewHtml = '';
    if (item.type === 'svg') {
      previewHtml = `<div class="asset-thumb"><i class="fa-solid fa-code-branch" style="font-size:1.8rem; color:var(--primary);"></i></div>`;
    } else {
      previewHtml = `<div class="asset-thumb"><img src="${item.url}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/150?text=Image+Error'" /></div>`;
    }

    card.innerHTML = `
      ${previewHtml}
      <div style="display:flex; flex-direction:column; gap:2px;">
        <div class="asset-title">${item.name}</div>
        <div class="asset-link">${item.url}</div>
      </div>
      <div class="asset-actions">
        <button class="btn-xs btn-copy-url" data-url="${item.url}"><i class="fa-solid fa-link"></i> Copy Link</button>
        ${item.url.startsWith('http') ? `<a href="${item.url}" target="_blank" class="btn-xs"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</a>` : ''}
      </div>
    `;

    card.querySelector('.btn-copy-url').addEventListener('click', (e) => {
      const urlToCopy = e.currentTarget.getAttribute('data-url');
      copyToClipboard(urlToCopy, 'Asset link copied');
    });

    elements.assetGridContainer.appendChild(card);
  });
}

// RENDER LIVE PREVIEW OF EXTRACTED SOURCE
function renderLivePreview() {
  if (!state.htmlRaw) return;

  const baseTag = `<base href="${state.targetUrl}">`;
  let liveDoc = state.htmlRaw;
  
  if (!liveDoc.includes('<base')) {
    liveDoc = liveDoc.replace(/<head>/i, `<head>${baseTag}`);
  }

  let cssInjections = '';
  state.styles.forEach(st => {
    if (st.content && !st.content.startsWith('/* External')) {
      cssInjections += `<style>\n${st.content}\n</style>\n`;
    }
  });

  if (cssInjections) {
    liveDoc = liveDoc.replace(/<\/head>/i, `${cssInjections}</head>`);
  }

  elements.previewIframe.srcdoc = liveDoc;
}

// DIRECT BROWSER DOWNLOAD VIA BLOB URL & REDIRECT TO CHROME / SAFARI / SYSTEM BROWSER
async function downloadViaBrowserRedirect(fileName, contentOrBlob, mimeType = 'application/octet-stream') {
  triggerHaptic();

  let blob;
  if (contentOrBlob instanceof Blob) {
    blob = contentOrBlob;
  } else {
    blob = new Blob([contentOrBlob], { type: mimeType });
  }

  // Create real Blob URL
  const blobUrl = URL.createObjectURL(blob);

  // 1. Direct Anchor Download Link with Target Blank
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // 2. Redirect to Chrome / Safari / Native System Browser if in Capacitor Native WebView
  if (window.Capacitor && window.Capacitor.isPluginAvailable("Browser")) {
    try {
      await window.Capacitor.Plugins.Browser.open({ url: blobUrl });
    } catch (e) {
      console.warn("Capacitor Browser plugin error", e);
    }
  } else if (window.Capacitor && window.Capacitor.isPluginAvailable("Share")) {
    try {
      if (window.Capacitor.isPluginAvailable("Filesystem")) {
        const { Filesystem, Directory } = window.Capacitor.Plugins;
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const tempFile = await Filesystem.writeFile({
              path: fileName,
              data: reader.result,
              directory: Directory.Cache
            });
            await window.Capacitor.Plugins.Share.share({
              title: fileName,
              url: tempFile.uri,
              dialogTitle: 'Download via Browser'
            });
          } catch (e) {}
        };
      }
    } catch (e) {}
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  showToast(`Downloading ${fileName} via browser`, 'success');
}

// DOWNLOAD FULL ZIP
async function downloadFullZip() {
  if (!state.htmlRaw) {
    showToast('Please extract website source first', 'error');
    return;
  }

  if (!window.JSZip) {
    showToast('JSZip library unavailable', 'error');
    return;
  }

  showToast('Preparing ZIP package...', 'info');
  triggerHaptic();

  const zip = new JSZip();
  const domainClean = state.parsedDomain.replace(/[^a-z0-9]/gi, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  const folderName = `RSource_${domainClean}_${timestamp}`;

  const root = zip.folder(folderName);

  root.file('index.html', state.htmlFormatted || state.htmlRaw);

  const jsFolder = root.folder('scripts');
  for (let i = 0; i < state.scripts.length; i++) {
    const s = state.scripts[i];
    if (s.type === 'external' && !s.fetched) {
      try {
        const res = await fetchWithProxy(s.url, elements.proxySelect.value);
        s.content = res.html;
        s.fetched = true;
      } catch (e) {
        s.content = `// Failed to fetch: ${s.url}`;
      }
    }
    const jsName = s.name.endsWith('.js') ? s.name : `${s.name}.js`;
    jsFolder.file(jsName, s.content);
  }

  const cssFolder = root.folder('styles');
  for (let i = 0; i < state.styles.length; i++) {
    const st = state.styles[i];
    if (st.type === 'external' && !st.fetched) {
      try {
        const res = await fetchWithProxy(st.url, elements.proxySelect.value);
        st.content = res.html;
        st.fetched = true;
      } catch (e) {
        st.content = `/* Failed to fetch: ${st.url} */`;
      }
    }
    const cssName = st.name.endsWith('.css') ? st.name : `${st.name}.css`;
    cssFolder.file(cssName, st.content);
  }

  const report = {
    app: 'RSource Website Source Code Extractor',
    version: '2.5 PRO',
    extractedAt: new Date().toLocaleString('id-ID'),
    targetUrl: state.targetUrl,
    domain: state.parsedDomain,
    title: state.title,
    metadata: state.metadata
  };

  root.file('metadata.json', JSON.stringify(report, null, 2));

  const blobZip = await zip.generateAsync({ type: 'blob' });
  const zipFileName = `${folderName}.zip`;

  await downloadViaBrowserRedirect(zipFileName, blobZip, 'application/zip');
}

// COPY TO CLIPBOARD
async function copyToClipboard(text, successMsg = 'Copied to clipboard') {
  try {
    if (window.Capacitor && window.Capacitor.isPluginAvailable("Clipboard")) {
      await window.Capacitor.Plugins.Clipboard.write({ string: text });
    } else {
      await navigator.clipboard.writeText(text);
    }
    triggerHaptic();
    showToast(successMsg, 'success');
  } catch (err) {
    showToast('Failed to copy to clipboard', 'error');
  }
}

// LISTENERS
function initEventListeners() {

  elements.fetchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    extractWebsiteSource(elements.urlInput.value);
  });

  elements.btnPaste.addEventListener('click', async () => {
    try {
      let text = '';
      if (window.Capacitor && window.Capacitor.isPluginAvailable("Clipboard")) {
        const res = await window.Capacitor.Plugins.Clipboard.read();
        text = res.value;
      } else {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        elements.urlInput.value = text;
        showToast('URL pasted', 'info');
      }
    } catch (e) {
      showToast('Clipboard access failed', 'error');
    }
  });

  elements.btnClear.addEventListener('click', () => {
    elements.urlInput.value = '';
    elements.urlInput.focus();
  });

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const url = chip.getAttribute('data-url');
      elements.urlInput.value = url;
      extractWebsiteSource(url);
    });
  });

  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      
      elements.tabBtns.forEach(b => b.classList.remove('active'));
      elements.tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${tabTarget}`).classList.add('active');

      triggerHaptic();
    });
  });

  elements.btnQuickZip.addEventListener('click', downloadFullZip);
  elements.btnQuickCopyHtml.addEventListener('click', () => copyToClipboard(state.htmlFormatted, 'HTML copied'));

  elements.btnFormatHtml.addEventListener('click', () => {
    if (window.html_beautify) {
      state.htmlFormatted = window.html_beautify(state.htmlRaw, { indent_size: 2 });
      renderHtmlTab();
      showToast('HTML formatted', 'success');
    }
  });

  elements.btnToggleWrapHtml.addEventListener('click', () => {
    state.wrapLines = !state.wrapLines;
    elements.htmlCodeContainer.classList.toggle('wrap', state.wrapLines);
    showToast(state.wrapLines ? 'Wrap enabled' : 'Wrap disabled', 'info');
  });

  elements.btnCopyHtml.addEventListener('click', () => copyToClipboard(state.htmlFormatted, 'HTML copied'));
  
  elements.btnDownloadHtml.addEventListener('click', async () => {
    const fileName = `${state.parsedDomain}_index.html`;
    const content = state.htmlFormatted || state.htmlRaw;
    await downloadViaBrowserRedirect(fileName, content, 'text/html');
  });

  elements.btnFormatJs.addEventListener('click', () => {
    const item = state.scripts[state.activeJsIndex];
    if (item && item.content && window.js_beautify) {
      item.content = window.js_beautify(item.content, { indent_size: 2 });
      elements.jsCodeViewer.textContent = item.content;
      if (window.Prism) Prism.highlightElement(elements.jsCodeViewer);
      showToast('JS formatted', 'success');
    }
  });

  elements.btnCopyJs.addEventListener('click', () => {
    const item = state.scripts[state.activeJsIndex];
    if (item) copyToClipboard(item.content, `Script ${item.name} copied`);
  });

  elements.btnDownloadJs.addEventListener('click', async () => {
    const item = state.scripts[state.activeJsIndex];
    if (item) {
      const fileName = item.name.endsWith('.js') ? item.name : `${item.name}.js`;
      await downloadViaBrowserRedirect(fileName, item.content, 'application/javascript');
    }
  });

  elements.btnFormatCss.addEventListener('click', () => {
    const item = state.styles[state.activeCssIndex];
    if (item && item.content && window.css_beautify) {
      item.content = window.css_beautify(item.content, { indent_size: 2 });
      elements.cssCodeViewer.textContent = item.content;
      if (window.Prism) Prism.highlightElement(elements.cssCodeViewer);
      showToast('CSS formatted', 'success');
    }
  });

  elements.btnCopyCss.addEventListener('click', () => {
    const item = state.styles[state.activeCssIndex];
    if (item) copyToClipboard(item.content, `Stylesheet ${item.name} copied`);
  });

  elements.btnDownloadCss.addEventListener('click', async () => {
    const item = state.styles[state.activeCssIndex];
    if (item) {
      const fileName = item.name.endsWith('.css') ? item.name : `${item.name}.css`;
      await downloadViaBrowserRedirect(fileName, item.content, 'text/css');
    }
  });

  document.querySelectorAll('.asset-filters .btn-xs').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.asset-filters .btn-xs').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      renderMediaTab(filter);
    });
  });

  document.querySelectorAll('.vp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vp-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const vp = btn.getAttribute('data-vp');
      elements.iframeBox.className = `iframe-box ${vp}`;
    });
  });

  elements.btnRefreshFrame.addEventListener('click', renderLivePreview);
  elements.btnOpenNewTab.addEventListener('click', () => {
    if (state.targetUrl) window.open(state.targetUrl, '_blank');
  });

  elements.btnDownloadZipFull.addEventListener('click', downloadFullZip);
  
  elements.btnDlHtmlOnly.addEventListener('click', async () => {
    const fileName = `${state.parsedDomain}_index.html`;
    const content = state.htmlFormatted || state.htmlRaw;
    await downloadViaBrowserRedirect(fileName, content, 'text/html');
  });
  
  elements.btnDlJsBundle.addEventListener('click', async () => {
    let combinedJs = `// Combined JavaScript Bundle from ${state.targetUrl}\n\n`;
    for (const s of state.scripts) {
      combinedJs += `/* =================== ${s.name} =================== */\n${s.content}\n\n`;
    }
    const fileName = `${state.parsedDomain}_bundle.js`;
    await downloadViaBrowserRedirect(fileName, combinedJs, 'application/javascript');
  });

  elements.btnDlCssBundle.addEventListener('click', async () => {
    let combinedCss = `/* Combined CSS Bundle from ${state.targetUrl} */\n\n`;
    for (const st of state.styles) {
      combinedCss += `/* =================== ${st.name} =================== */\n${st.content}\n\n`;
    }
    const fileName = `${state.parsedDomain}_bundle.css`;
    await downloadViaBrowserRedirect(fileName, combinedCss, 'text/css');
  });

  elements.searchHtmlInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    if (!query) {
      renderHtmlTab();
      return;
    }
    const lines = state.htmlFormatted.split('\n');
    const filteredLines = lines.filter(line => line.toLowerCase().includes(query));
    elements.htmlCodeViewer.textContent = filteredLines.join('\n');
    if (window.Prism) Prism.highlightElement(elements.htmlCodeViewer);
  });
}

// APP INIT
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  const defaultUrl = 'https://wikipedia.org';
  elements.urlInput.value = defaultUrl;
  extractWebsiteSource(defaultUrl);
});
