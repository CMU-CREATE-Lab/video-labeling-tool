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
  var counter = 0;
  var max_counter = 10;
  var count_down_duration = 0; // in milliseconds
  var count_down_timeout;
  var api_url_root = util.getRootApiUrl();

  function resetCountDown() {
    clearTimeout(count_down_timeout);
    $next.removeClass("count-down-" + counter);
    counter = 0;
  }

  function countDown() {
    if (counter == 0) {
      $next.addClass("count-down-0");
    }
    count_down_timeout = setTimeout(function () {
      $next.removeClass("count-down-" + counter);
      if (counter == max_counter) {
        $next.prop("disabled", false);
        counter = 0;
      } else {
        $next.addClass("count-down-" + (counter + 1));
        counter += 1;
        countDown();
      }
    }, count_down_duration);
  }

  // Add tutorial record based on action types
  // 0: take the tutorial
  // 1: pass the last batch (16 videos) in the tutorial during the first try
  // 2: pass the last batch during the second try after showing the answers
  // 3: pass the last batch (16 videos) during the third try with hints
  // 4: did not pass the last batch in the tutorial
  function addTutorialRecord(action_type) {
    util.postJSON(api_url_root + "add_tutorial_record", {
      "user_token": user_token,
      "action_type": action_type
    }, {
      error: function (xhr) {
        console.error("Error when adding tutorial record!");
      }
    });
  }

  function onLoginSuccess(data) {
    user_token = data["user_token"];
    addTutorialRecord(0);
  }

  function onLoginComplete() {
    next();
  }

  function next() {
    $next.prop("disabled", true);
    resetCountDown();
    $(window).scrollTop(0);
    tutorial_tool.next({
      success: function () {
        if (!is_video_autoplay_tested) {
          video_test_dialog.startVideoPlayTest(1000);
          is_video_autoplay_tested = true;
        }
        countDown();
      }
    });
  }

  function init() {
    $next = $("#next");
    $next.on("click", function () {
      next();
    });
    tutorial_tool = new edaplotjs.TutorialTool("#tutorial-tool-container", {
      data: tutorial_data, // this is in tutorial_data.js
      on_tutorial_finished: function (num_tries_to_pass) {
        $next.hide();
        $("#label").removeClass("force-hidden");
        $("#tutorial-end-text").removeClass("force-hidden");
        $("#tutorial-tool-container").hide();
        addTutorialRecord(num_tries_to_pass);
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