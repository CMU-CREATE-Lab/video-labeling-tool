(function () {
  "use strict";

  var util = new edaplotjs.Util();
  var tutorial_tool;
  var ga_tracker;
  var google_account_dialog;
  var video_test_dialog;
  var is_video_autoplay_tested = false;
  var user_token;
  var $next;

  function onLoginSuccess(data) {
    user_token = data["user_token"];
    console.log("onLoginSuccess");
  }

  function onLoginComplete() {
    next();
  }

  function next() {
    $next.prop("disabled", true);
    $(window).scrollTop(0);
    tutorial_tool.next({
      success: function () {
        if (!is_video_autoplay_tested) {
          video_test_dialog.startVideoPlayTest(1000);
          is_video_autoplay_tested = true;
        }
        $next.prop("disabled", false);
      }
    });
  }

  function init() {
    $next = $("#next");
    $next.on("click", function () {
      $("#tutorial-start-text").hide();
      next();
    });
    tutorial_tool = new edaplotjs.TutorialTool("#tutorial-tool-container", {
      data: tutorial_data, // this is in tutorial_data.js
      on_tutorial_finished: function () {
        $next.hide();
        $("#label").removeClass("force-hidden");
        $("#tutorial-start-text").hide();
        $("#tutorial-end-text").removeClass("force-hidden");
        $("#tutorial-tool-container").hide();
      }
    });
    google_account_dialog = new edaplotjs.GoogleAccountDialog({
      no_ui: true
    });
    video_test_dialog = new edaplotjs.VideoTestDialog();
    ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId(),
      ready: function (client_id) {
        google_account_dialog.silentSignInWithGoogle({
          success: function (is_signed_in, google_user) {
            if (is_signed_in) {
              util.login({
                google_id_token: google_user.getAuthResponse().id_token
              }, {
                success: onLoginSuccess,
                complete: onLoginComplete
              });
            } else {
              util.login({
                client_id: client_id
              }, {
                success: onLoginSuccess,
                complete: onLoginComplete
              });
            }
          },
          error: function (error) {
            console.error("Error with Google sign-in: ", error);
            util.login({
              client_id: client_id
            }, {
              success: onLoginSuccess,
              complete: onLoginComplete
            });
          }
        });
      }
    });
    util.updateLabelStatistics();
  }

  $(init);
})();