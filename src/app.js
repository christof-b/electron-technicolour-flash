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
          jquery('#progress').append('<p class="text-info">Authenticating...</p>');
        });
      } else {
        jquery('#progress').append('<p class="text-danger">Auth failed!</p>');
      }
    } else {
      jquery('#progress').append('<p class="text-success">Auth successful</p>');
      webview.send('csrf-token-request');
    }
  });

  webview.addEventListener("ipc-message", function(e) {
    if (e.channel === "csrf-token-response") {
      const token = e.args[0];
      const firmware = jquery('#inputFirmwareFileName').val();
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

          jquery('#progress').append('<p class="text-info">Uploading firmware...</p>');

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
                jquery('#progress').append('<p class="text-success">Upload successful!</p>');
                jquery('#progress').append('<p class="text-info">Waiting for reboot...</p>');
                setTimeout(function() {
                  jquery('#progress').append('<p class="text-info">Try to reconnect...</p>');
                  (async () => {
                    await got('http://' + host, {
                      retry: {
                        retries: (retry, error) => {
                          jquery('#progress').append('<p class="text-mute">Retry #' + retry + ', waiting...</p>')
                          return 5000;
                        }
                      }
                    });
                    jquery('#progress').append('<p class="text-success">Ready to continue!</p>');
                    //TODO continue
                  })();
                }, 120000);
              } else {
                jquery('#progress').append('<p class="text-danger">Upload failed!</p>');
                console.log(response.body);
                console.log(result);
              }
            } catch (error) {
              jquery('#progress').append('<p class="text-danger">An error occured!</p>');
              console.log(error);
              //=> 'Internal server error ...'
            }
          })();

        });
      });
    }
  });

  if (env.name !== "development") {
    jquery('webview').hide();
  }
  jquery('#app').append('<div class="jumbotron mt-4" id="progress"><h1>Progress</h1><p class="text-info">Loading firmware...</p></div>');

  webview.loadURL('http://' + host + '/login.lp');
})

jquery('#app').show();