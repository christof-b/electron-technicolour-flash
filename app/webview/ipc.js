const {
  ipcRenderer
} = require('electron');

ipcRenderer.on('csrf-token-request', () => {
  const $ = require('jquery');
  ipcRenderer.sendToHost('csrf-token-response', $('meta[name=CSRFtoken]').attr('content'));
})

if (/login/.test(window.location.href)) {
  document.addEventListener("DOMContentLoaded", function() {
    const errorMessage = document.querySelector("#erroruserpass");
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        console.log('login failed');
        ipcRenderer.sendToHost('login-failed', {});
      });
    });
    observer.observe(errorMessage, {
      attributes: true
    });
  });
}