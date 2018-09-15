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

import got from "got";
import FormData from "form-data";
import {
  CookieJar
} from 'tough-cookie';

import path from 'path';

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
      const firmwarePath = appPath + path.sep + 'firmware' + path.sep + firmware;

      const stats = fs.statSync(firmwarePath);
      console.log(stats);

      fs.readFile(firmwarePath, (err, data) => {

        const form = new FormData({
          maxDataSize: stats.size + 1024
        });
        form.append('CSRFtoken', token);
        form.append('upgradefile', new Buffer(data, 'binary'), {
          knownLength: stats.size
        });
        const cookieJar = new CookieJar();
        let session = webview.getWebContents().session;

        session.cookies.get({
          url: 'http://' + host
        }, function(error, cookies) {
          for (var i = 0; i < cookies.length; i++) {
            let info = cookies[i];
            cookieJar.setCookie(`${info.name}=${info.value};`, 'http://' + host, () => {});
            console.log(info.name, info.value);
          }

          console.log("Uploading firmware...");

          (async () => {
            try {
              const response = await got.post('/modals/gateway-modal.lp?action=upgradefw', {
                cookieJar: cookieJar,
                baseUrl: 'http://' + host,
                body: form,
                agent: null
              }).on('uploadProgress', (progress) => {
                console.log(progress);
              });
              const result = JSON.parse(response.body);
              if (result.success !== undefined && result.success) {
                console.log("Upload successful!");
                console.log("Waiting for reboot...");
                setTimeout(function() {
                  console.log("Try to reconnect...");
                  (async () => {
                    await got('http://' + host, {
                      retry: {
                        retries: (retry, error) => {
                          console.log('Retry #' + retry + ', waiting...')
                          return 5000;
                        }
                      }
                    });
                    console.log("Ready to continue!");
                    //TODO continue
                  })();
                }, 120000);
              } else {
                console.log("Upload failed:");
                console.log(response.body);
                console.log(result);
              }
            } catch (error) {
              console.log(error);
              //=> 'Internal server error ...'
            }
          })();

        });
      });
    }
  });

  webview.loadURL('http://' + host + '/login.lp');
})

jquery('#app').show();