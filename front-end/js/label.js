(function () {
  "use strict";

  var util = new edaplotjs.Util();
  var video_labeling_tool;
  var google_account_dialog;
  var video_test_dialog;
  var $next;
  var counter = 0;
  var max_counter = 10;
  var count_down_duration = 500; // in milliseconds
  var is_first_time = true;
  var is_video_autoplay_tested = false;
  var ga_tracker;

  function countDown() {
    if (counter == 0) {
      $next.addClass("count-down-0");
    }
    setTimeout(function () {
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

  function nextBatch(ignore_labels) {
    $next.prop("disabled", true);
    $(window).scrollTop(0);
    video_labeling_tool.next({
      success: function () {
        if (!is_video_autoplay_tested) {
          video_test_dialog.startVideoPlayTest(1000);
          is_video_autoplay_tested = true;
        }
        countDown();
      },
      abort: function () {
        $next.prop("disabled", false);
      }
    }, {
      ignore_labels: ignore_labels
    });
  }

  function printServerErrorMsg(xhr) {
    console.error("Server respond: " + JSON.stringify(xhr.responseJSON));
  }

  function printServerWarnMsg(xhr) {
    console.warn("Server respond: " + JSON.stringify(xhr.responseJSON));
  }

  function onUserIdChangeSuccess(new_user_id) {
    $("#review").prop("href", "gallery.html" + "?user_id=" + new_user_id);
    google_account_dialog.updateUserId(new_user_id);
    if (is_first_time) {
      $next = $("#next");
      $next.on("click", function () {
        nextBatch();
      });
      nextBatch();
      var $account_dialog = google_account_dialog.getDialog();
      google_account_dialog.isAuthenticatedWithGoogle(function (is_signed_in) {
        if (!is_signed_in) {
          $account_dialog.dialog("open");
        }
      });
      is_first_time = false;
    } else {
      // Each video batch is signed with the user id
      // So we need to load a new batch after the user id changes
      // Otherwise the server will return an invalid signature error
      nextBatch(true);
    }
  }

  function init() {
    video_labeling_tool = new edaplotjs.VideoLabelingTool("#labeling-tool-container", {
      on_user_score_update: function (score) {
        if (video_labeling_tool.isAdmin()) {
          score = undefined;
        }
        google_account_dialog.updateUserScore(score);
      }
    });
    google_account_dialog = new edaplotjs.GoogleAccountDialog({
      sign_in_success: function (google_user) {
        video_labeling_tool.updateUserIdByGoogleIdToken(google_user.getAuthResponse().id_token, {
          success: function (obj) {
            onUserIdChangeSuccess(obj.userId());
          },
          error: function (xhr) {
            console.error("Error when updating user id by using google token!");
            printServerErrorMsg(xhr);
          }
        });
      },
      sign_out_success: function () {
        video_labeling_tool.updateUserIdByClientId(ga_tracker.getClientId(), {
          success: function (obj) {
            onUserIdChangeSuccess(obj.userId());
          },
          error: function (xhr) {
            console.error("Error when updating user id when signing out from google!");
            printServerErrorMsg(xhr);
          }
        });
      }
    });
    video_test_dialog = new edaplotjs.VideoTestDialog();
    ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId(),
      ready: function (client_id) {
        google_account_dialog.isAuthenticatedWithGoogle(function (is_signed_in) {
          // If signed in, will be handled by the callback function of initGoogleSignIn() in the GoogleAccountDialog object
          if (!is_signed_in) {
            video_labeling_tool.updateUserIdByClientId(client_id, {
              success: function (obj) {
                onUserIdChangeSuccess(obj.userId());
              },
              error: function (xhr) {
                console.error("Error when updating user id when updating user id by client id!");
                printServerErrorMsg(xhr);
                $("#start").prop("disabled", true).find("span").text("Error when connecting to server");
              }
            });
          }
        });
      }
    });
  }

  $(init);
})();