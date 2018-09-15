const {
  ipcRenderer
} = require('electron')
ipcRenderer.on('csrf-token-request', () => {
  $ = require('jquery');
  ipcRenderer.sendToHost('csrf-token-response', $('meta[name=CSRFtoken]').attr('content'));
})