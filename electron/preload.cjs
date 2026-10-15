// Context-isolated preload: no Node APIs exposed to the renderer beyond a marker.
window.addEventListener('DOMContentLoaded', () => { document.documentElement.dataset.inkpadShell = 'electron'; });
