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


import request from "request";

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
  webview.addEventListener('did-finish-load', (event) => {

    if (/login/.test(webview.getURL())) {
      if (tries === 0) {
        tries++;
        fs.readFile(appPath + '/webview/login.js', 'utf8', (err, data) => {
          if (err) throw err;
          data = data.replace(/##username##/gi, username);
          data = data.replace(/##password##/gi, password);
          webview.executeJavaScript(data);
          console.log('Authenticating...');
        });
      } else {
        console.log("AUTH FAILED!");
      }
    } else if (/gateway-modal/.test(webview.getURL())) {


    } else {
      console.log("AUTH SUCCESS");
      webview.send('csrf-token-request');
    }
  });

  webview.addEventListener("ipc-message", function(e) {
    if (e.channel === "csrf-token-response") {
      const token = e.args[0];
      const firmware = 'AGTHP_1.1.0_CLOSED.rbi';
      const firmwarePath = appPath + '/firmware/' + firmware;
      const stats = fs.statSync(firmwarePath);
      let session = webview.getWebContents().session;
      let requestSession = request.jar();

      session.cookies.get({
        url: 'http://' + host
      }, function(error, cookies) {
        console.log(cookies);
        let cookieStr = ''
        for (var i = 0; i < cookies.length; i++) {
          let info = cookies[i];
          requestSession.setCookie(request.cookie(`${info.name}=${info.value};`), 'http://' + host, {});
          console.log(info.value, info.name);
        }

        console.log("Uploading firmware...");

        request({
            jar: requestSession,
            url: 'http://' + host + '/modals/gateway-modal.lp?action=upgradefw',
            method: 'POST',
            formData: {
              'CSRFtoken': token,
              'upgradefile': fs.createReadStream(firmwarePath, {
                flags: 'r'
              })
            }
          },
          function(err, response, body) {
            if (err == null && /success/.test(body)) {
              console.log("Flashing...");
              setTimeout(function() {
                console.log("Try to reconnect...");
                request
                  .get('http://' + host)
                  .on('error', function(err) {
                    //TODO wait for 5s and repeat
                  })
                  .on('response', function(response) {
                    //TODO continue flashing
                  })
              }, 120000);
            } else {
              console.log("Flashing failed:");
              console.log(err);
              console.log(body);
            }
          });
      });
    }
  });

  webview.loadURL('http://' + host + '/login.lp');
})

jquery('#app').show();