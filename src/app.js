import "./stylesheets/main.css";

// Small helpers you might want to keep
import "./helpers/context_menu.js";
import "./helpers/external_links.js";

// Bootstrap
import "../node_modules/bootstrap/dist/js/bootstrap.bundle.js"
import "../node_modules/bootstrap/dist/css/bootstrap.css"

import jquery from "jquery";

import {
  remote
} from "electron";

const dialog = remote.dialog;
const fs = remote.require('fs');
const appPath = process.env.NODE_ENV === 'production' ? remote.app.getAppPath() : __dirname;

jquery('#start-button').click(function(ev) {
  ev.preventDefault();
  jquery('#intro').hide();
  jquery('#form').show();
  return false;
});

jquery('#inputChangeCommand').click(function() {
  if (jquery('#inputChangeCommand').is(":checked")) {
    jquery('#inputCommand').removeAttr('disabled');
  } else {
    jquery('#inputCommand').attr('disabled', 'disabled');
  }
});

jquery('#run').click(function(ev) {
  ev.preventDefault();
  jquery('#form').hide();
  const username = jquery('#inputUsername').val();
  const password = jquery('#inputPassword').val();
  const host = jquery('#inputTargetIP').val();
  const webview = document.querySelector('webview');
  let tries = 0;
  webview.addEventListener('dom-ready', (event) => {

    if (/login/.test(webview.getURL())) {
      if (tries === 0) {
        tries++;
        fs.readFile(appPath + '/webview/inject.js', 'utf8', (err, data) => {
          if (err) throw err;
          data = data.replace(/##username##/gi, username);
          data = data.replace(/##password##/gi, password);
          webview.executeJavaScript(data);
        });
      } else {
        console.log("AUTH FAILED!");
      }
    } else {
      console.log("AUTH SUCCESS");
      webview.loadURL('http://' + host + '/modals/gateway-modal.lp?action=upgradefw', {

      })
    }



  });
  webview.loadURL('http://' + host + '/login.lp');
})

jquery('#app').show();