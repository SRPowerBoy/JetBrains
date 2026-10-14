// Shared helpers: storage that never throws, file download/open, HTML sanitizing.
const Store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  // Returns false when storage is unavailable or full, so callers can trim and retry.
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } },
};

function download(filename, data, type) {
  const blob = data instanceof Blob ? data : new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pickFile(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

function safeName(title, fallback) {
  return (title || fallback).replace(/[\\/:*?"<>|]+/g, '_').trim() || fallback;
}

// Strip anything executable from untrusted HTML (opened files, share links).
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll('script,style,iframe,frame,object,embed,link,meta,base,form,input,button,textarea,select')
    .forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => {
    const name = a.name.toLowerCase();
    if (name.startsWith('on')) n.removeAttribute(a.name);
    else if (/(^|:)(href|src|action|formaction)$/.test(name) &&
             !/^\s*(https?:|mailto:|#|data:image\/(png|jpe?g|gif|webp);)/i.test(a.value)) n.removeAttribute(a.name);
  }));
  return doc.body.innerHTML;
}
