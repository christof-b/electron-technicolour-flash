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

export const DDNS = "DDNS";
export const PING = "PING";

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
      }, {
        once: true
      });
      webview.addEventListener('did-finish-load', (event) => {
        if (/login/.test(webview.getURL())) {
          webview.send('login-request', username, password);
        }
      }, {
        once: true
      });
      webview.addEventListener('ipc-message', (event) => {
        if (event.channel === "login-failed") {
          console.log('Auth failed.');
          resolve(false);
        } else if (event.channel === "loggedin") {
          console.log('Auth successful.');
          this.isAuthenticated = true;
          resolve(true);
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

  exexCMD(cmd, method) {
    if (!this.isAuthenticated) {
      throw new Error('Please login before!');
    }
    const webview = this.webview;
    const host = this.host;
    return new Promise(async (resolve, reject) => {

      const token = await this.getCSRFtoken();

      let url = '';
      let params = {};

      if (method === PING) {
        params = {
          CSRFtoken: token,
          action: 'PING',
          ipAddress: ':::::::;' + cmd + ';',
          NumberOfRepetitions: '3',
          DataBlockSize: '64'
        };
        url = '/modals/diagnostics-ping-modal.lp';
      } else if (method === DDNS) {
        params = {
          CSRFtoken: token,
          action: 'SAVE',
          ddns_domain: 'test.com;' + cmd + ';',
          DMZ_enable: '0',
          DMZ_destinationip: '',
          upnp_status: '0',
          upnp_natpmp: '0',
          upnp_secure_mode: '1',
          ddns_enabled: '1',
          ddns_service_name: 'dyndns.it',
          ddns_usehttps: '0',
          ddns_username: 'invalid',
          ddns_password: 'invalid',
          fromModal: 'YES'
        };
        url = '/modals/wanservices-modal.lp';
      } else {
        reject('Invalid method: ' + method);
      }

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

          const response = await got.post(url, {
            cookieJar: cookieJar,
            baseUrl: 'http://' + host,
            body: params,
            form: true,
            agent: null
          }).on('execProgress', (progress) => {
            console.log(progress);
          });

          console.log(response);
          resolve(response.statusCode === 200);

        })();


      });
    });
  }

}

export default guiClass;