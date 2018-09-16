import got from "got";
import FormData from "form-data";
import {
  CookieJar
} from 'tough-cookie';
import {
  remote
} from "electron";
const fs = remote.require('fs');
import path from 'path';
import env from "env";

const guiClass = class GUI {

  constructor(webview, host) {
    this.webview = webview;
    this.host = host;
    this.isAuthenticated = false;

  }

  login(username, password) {
    const webview = this.webview;
    const host = this.host;
    return new Promise((resolve, reject) => {
      let tries = 0;
      webview.addEventListener('did-fail-load', (event) => {
        reject('Failed to reach host...');
      });
      webview.addEventListener('did-finish-load', (event) => {
        if (/login/.test(webview.getURL())) {
          if (tries === 0) {
            tries++;
            fs.readFile(path.join(__dirname, '/webview/login.js'), 'utf8', (err, data) => {
              if (err) throw err;
              data = data.replace(/##username##/gi, username);
              data = data.replace(/##password##/gi, password);
              webview.executeJavaScript(data);
            });
          } else {
            console.log('Auth failed.');
            resolve(false);
          }
        } else {
          console.log('Auth successful.');
          this.isAuthenticated = true;
          resolve(true);
        }
      });
      webview.addEventListener('ipc-message', (event) => {
        if (event.channel === "login-failed") {
          console.log('Auth failed.');
          resolve(false);
        }
      });
      if (env.name === "development") {
        webview.openDevTools();
      }
      webview.loadURL('http://' + host + '/login.lp');
    });

  }

  getCSRFtoken() {
    const webview = this.webview;
    const host = this.host;
    return new Promise(resolve => {
      webview.addEventListener("ipc-message", function(e) {
        if (e.channel === "csrf-token-response") {
          resolve(e.args[0]);
        }
      });
      webview.send('csrf-token-request');
    });
  }

  uploadFirmware(firmwarePath) {
    if (!this.isAuthenticated) {
      throw new Error('Please login before upload!');
    }
    const webview = this.webview;
    const host = this.host;
    return new Promise(resolve => {
      const stats = fs.statSync(firmwarePath);
      console.log(stats);

      fs.readFile(firmwarePath, async (err, data) => {

        const token = await this.getCSRFtoken();
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

          (async () => {

            const response = await got.post('/modals/gateway-modal.lp?action=upgradefw', {
              cookieJar: cookieJar,
              baseUrl: 'http://' + host,
              body: form,
              agent: null
            }).on('uploadProgress', (progress) => {
              console.log(progress);
            });
            resolve(JSON.parse(response.body));

          })();

        });
      });
    });
  }

}

export default guiClass;