if (/login/.test(window.location.href)) {
  $('input[type=text]').first().val('##username##');
  $('input[type=password]').first().val('##password##');
  $('#sign-me-in').click();
}