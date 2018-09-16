import "./stylesheets/main.css";

// Small helpers you might want to keep
import "./helpers/context_menu.js";
import "./helpers/external_links.js";

// Bootstrap
import "../node_modules/bootstrap/dist/js/bootstrap.bundle.js"
import "../node_modules/bootstrap/dist/css/bootstrap.css"
import GUI from "./technicolour/GUI"
import jquery from "jquery";
import got from "got";
import sleep from "./helpers/sleep";

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

jquery('#run').click(async (ev) => {
  ev.preventDefault();
  jquery('#form').hide();
  jquery('#app').append('<div class="jumbotron mt-4" id="progress"><h1>Progress</h1></div><button type="button" class="btn btn-primary" id="back">cancel</button>');
  jquery('#back').click(() => {
    location.reload();
  });

  const username = jquery('#inputUsername').val();
  const password = jquery('#inputPassword').val();
  const host = jquery('#inputTargetIP').val();

  const gui = new GUI(document.querySelector('#client'), host);

  jquery('#progress').append('<p class="text-info">Authenticating...</p>');
  const loginResult = await gui.login(username, password);
  if (loginResult !== true) {
    jquery('#progress').append('<p class="text-danger">Auth failed!</p>');
  } else {
    jquery('#progress').append('<p class="text-success">Auth successful</p>');

    jquery('#progress').append('<p class="text-info">Loading firmware...</p>');

    const firmware = jquery('#inputFirmwareFileName').val();
    const firmwarePath = path.join(__dirname, '/firmware/' + firmware);

    try {
      if (jquery('#inputFlashFirmware').is(':checked')) {

        jquery('#progress').append('<p class="text-info">Uploading firmware...</p>');

        jquery('#back').attr('disabled', 'disabled');
        const result = await gui.uploadFirmware(firmwarePath);
        jquery('#back').removeAttr('disabled');

        if (result.success !== undefined && result.success) {
          jquery('#progress').append('<p class="text-success">Upload successful!</p>');

          jquery('#progress').append('<p class="text-info">Waiting for reboot...</p>');
          await sleep(12000);
          jquery('#progress').append('<p class="text-info">Try to reconnect...</p>');
          await got('http://' + host, {
            retry: {
              retries: (retry, error) => {
                jquery('#progress').append('<p class="text-mute">Retry #' + retry + ', waiting...</p>')
                return 5000;
              }
            }
          });

          jquery('#progress').append('<p class="text-success">Flash successfull!</p>');
          jquery('#back').html('back');

        } else {
          jquery('#back').html('back');
          jquery('#progress').append('<p class="text-danger">Upload failed!</p>');
          console.log(response.body);
          console.log(result);
          throw new Error(response);
        }

      }

      jquery('#progress').append('<p class="text-success">Ready to continue...</p>');
      //TODO root device

    } catch (error) {
      jquery('#back').html('back');
      jquery('#back').removeAttr('disabled');
      jquery('#progress').append('<p class="text-danger">An error occured!</p>');
      console.log(error);
      //=> 'Internal server error ...'
    }

  }

});

if (env.name === "development") {
  jquery('webview').css('height', '400px');
}

jquery('#app').show();