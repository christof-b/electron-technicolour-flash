import "./stylesheets/main.css";

// Small helpers you might want to keep
import "./helpers/context_menu.js";
import "./helpers/external_links.js";

// Bootstrap
import "../node_modules/bootstrap/dist/js/bootstrap.bundle.js"
import "../node_modules/bootstrap/dist/css/bootstrap.css"
import GUI from "./technicolour/GUI"
import {
  PING,
  DDNS
} from "./technicolour/GUI"
import jquery from "jquery";
import got from "got";
import sleep from "./helpers/sleep";
import SSHClient from "node-ssh";

import {
  remote
} from "electron";

const dialog = remote.dialog;
const fs = remote.require('fs');

import path from 'path';
import env from "env";

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

function doLogin(gui) {
  return new Promise(async (resolve, reject) => {
    const username = jquery('#inputUsername').val();
    const password = jquery('#inputPassword').val();

    jquery('#progress').append('<p class="text-info">Authenticating...</p>');

    try {
      const loginResult = await gui.login(username, password);
      if (loginResult !== true) {
        jquery('#back').html('back');
        jquery('#progress').append('<p class="text-danger">Auth failed!</p>');
      } else {
        resolve(true);
        jquery('#progress').append('<p class="text-success">Auth successful</p>');
      }
    } catch (err) {
      console.log(err);
      jquery('#back').html('back');
      jquery('#progress').append('<p class="text-danger">' + err + '</p>');
    }
    resolve(false);
  });
}

function rebooting(gui, host) {
  return new Promise(async (resolve, reject) => {
    jquery('#progress').append('<p class="text-info">Waiting for reboot...</p>');
    await sleep(120000);
    jquery('#progress').append('<p class="text-info">Try to reconnect...</p>');
    await got('http://' + host, {
      retry: {
        retries: (retry, error) => {
          jquery('#progress').append('<p class="text-mute">Retry #' + retry + ', waiting...</p>')
          return 5000;
        }
      }
    });

    resolve(await doLogin(gui));

  });
}

jquery('#run').click(async (ev) => {
  ev.preventDefault();
  jquery('#form').hide();
  jquery('#app').append('<div class="jumbotron mt-4" id="progress"><h1>Progress</h1></div><button type="button" class="btn btn-primary" id="back">cancel</button>');
  jquery('#back').click(() => {
    location.reload();
  });

  const host = jquery('#inputTargetIP').val();

  try {
    const gui = new GUI(document.querySelector('#client'), host);

    let authenticated = await doLogin(gui);

    if (authenticated) {
      if (jquery('#inputFlashFirmware').is(':checked')) {

        jquery('#progress').append('<p class="text-info">Loading firmware...</p>');

        const firmware = jquery('#inputFirmwareFileName').val();
        const firmwarePath = path.join(__dirname, '/firmware/' + firmware);

        jquery('#progress').append('<p class="text-info">Uploading firmware...</p>');

        jquery('#back').attr('disabled', 'disabled');
        const result = await gui.uploadFirmware(firmwarePath);
        jquery('#back').removeAttr('disabled');

        if (result.success !== undefined && result.success) {
          jquery('#progress').append('<p class="text-success">Upload successful!</p>');

          authenticated = await rebooting(gui, host);
          if (authenticated) {
            jquery('#progress').append('<p class="text-success">Flash successfull!</p>');
          } else {
            jquery('#back').html('back');
            jquery('#progress').append('<p class="text-danger">Failed to reauth!</p>');
            throw Error('Failed to reauth');
          }

        } else {
          jquery('#back').html('back');
          jquery('#progress').append('<p class="text-danger">Upload failed!</p>');
          console.log(response.body);
          console.log(result);
          throw new Error(response);
        }

      }

      if (jquery('#inputRootDevice').is(':checked')) {
        jquery('#progress').append('<p class="text-info">Start rooting of device...</p>');
        const commands = jquery('#inputSplitCommand').is(':checked') ? jquery('#inputCommand').val().split(';') : [jquery('#inputCommand').val()];
        const method = jquery('#inputRootMethod').val();
        for (let i = 0; i < commands.length; i++) {
          const cmd = commands[i];
          jquery('#progress').append('<p class="text-mute">' + method + ' Exec "' + cmd + '"...</p>');
          const result = await gui.exexCMD(cmd, method);
          if (result !== true) {
            throw new Error('Failed to exec: ' + cmd);
          }
          await sleep(5000);
        }

        console.log('Establish SSH connection...');
        const ssh = new SSHClient();
        await ssh.connect({
          host: host,
          username: 'root',
          password: 'root'
        });

        const handler = require('serve-handler');
        const http = require('http');
        const portfinder = require('portfinder');
        const os = require("os");

        portfinder.basePort = 8080;
        const localPort = await new Promise((resolve, reject) => {
          portfinder.getPort(function(err, port) {
            if (err) {
              reject(err);
            }
            resolve(port);
          });
        });

        const remoteIP = host.split('.');
        let localhost = '0.0.0.0';

        Object.values(os.networkInterfaces()).forEach((iface) => {
          iface.forEach((config) => {
            const localIP = config.address.split('.');
            if (localIP[0] == remoteIP[0] && localIP[1] == remoteIP[1] && localIP[2] == remoteIP[2]) {
              localhost = config.address;
            }
          })
        })

        const server = http.createServer((request, response) => {
          // You pass two more arguments for config and middleware
          // More details here: https://github.com/zeit/serve-handler#options
          return handler(request, response, {
            "public": __dirname
          });
        })

        await new Promise((resolve, reject) => {
          server.listen(localPort, localhost, () => {
            console.log('Serving at http://' + localhost + ':' + localPort);
            resolve(true);
          }).on('error', (e) => {
            server.close();
            reject(e);
          });
        });

        const sshCommands = [
          'wget -O /tmp/dga4132_unlocked.tar.gz http://' + localhost + ':' +
          localPort + '/gui/dga4132_unlocked.tar.gz',
          'tar -zxvf /tmp/dga4132_unlocked.tar.gz -C /',
          '/etc/init.d/rootdevice force',
          '/etc/init.d/rootdevice force'
        ];

        for (let c = 0; c < sshCommands.length; c++) {
          jquery('#progress').append('<p class="text-mute">SSH Exec "' + sshCommands[c] + '"...</p>');
          const result = await ssh.execCommand(sshCommands[c], {}, (err, channel) => {
            console.log(err);
            throw Error(err);
          });
          if (result.code !== 0) {
            console.log(result);
            throw Error(result);
          }
        };

        server.close();

        ssh.execCommand('reboot', {}, (err, channel) => {
          console.log(err);
        });

        /*
        //TODO fix gui or ngynx or chrome
        authenticated = await rebooting(gui, host);
        if (authenticated) {
          jquery('#progress').append('<p class="text-success">Rooting successfull!</p>');
        } else {
          jquery('#back').html('back');
          jquery('#progress').append('<p class="text-danger">Failed to reauth!</p>');
          throw Error('Failed to reauth');
        }
        */
        jquery('#progress').append('<p class="text-success">After reboot you can login via web and ssh (root:root)</p>');
      }
      jquery('#progress').append('<p class="text-success">Done!</p>');
      jquery('#back').html('back');
    }

  } catch (error) {
    jquery('#back').html('back');
    jquery('#back').removeAttr('disabled');
    jquery('#progress').append('<p class="text-danger">An error occured!</p>');
    console.log(error);
    //=> 'Internal server error ...'
  }



});

if (env.name === "development") {
  jquery('webview').css('height', '400px');
}

jquery('#app').show();