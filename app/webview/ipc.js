const {
  ipcRenderer
} = require('electron');

ipcRenderer.on('csrf-token-request', () => {
  const $ = require('jquery');
  ipcRenderer.sendToHost('csrf-token-response', $('meta[name=CSRFtoken]').attr('content'));
})

if (/login/.test(window.location.href)) {

  ipcRenderer.on('login-request', (event, username, password) => {
    console.log('login started...');
    const $ = require('jquery');
    $('input[type=text]').first().val(username);
    $('input[type=password]').first().val(password);
    $('#sign-me-in').click();
  });

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
} else {
  document.addEventListener("DOMContentLoaded", function() {
    const $ = require('jquery');
    if ($('title').html().toLowerCase().trim() !== 'login') {
      console.log('loggedin');
      ipcRenderer.sendToHost('loggedin', {});
    }

  });
}