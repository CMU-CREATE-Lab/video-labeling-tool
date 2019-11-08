(function () {
  "use strict";

  var util = new edaplotjs.Util();
  var video_labeling_tool;
  var google_account_dialog;
  var video_test_dialog;
  var tutorial_prompt_dialog;
  var $next;
  var counter = 0;
  var max_counter = 10;
  var count_down_duration = 1000; // in milliseconds
  var is_first_time = true;
  var is_video_autoplay_tested = false;
  var ga_tracker;
  var $sign_in_prompt;
  var $user_score_container;
  var $user_score_text;
  var $user_raw_score_text;
  var count_down_timeout;
  var consecutive_failed_batches = 0;
  var api_url_root = util.getRootApiUrl();
  var $quality_check_passed_text;

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

  function nextBatch(ignore_labels) {
    $next.prop("disabled", true);
    resetCountDown();
    $(window).scrollTop(0);
    video_labeling_tool.next({
      success: function () {
        if (!is_video_autoplay_tested) {
          video_test_dialog.startVideoPlayTest(1000);
          is_video_autoplay_tested = true;
        }
        countDown();
        util.updateLabelStatistics();
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
      google_account_dialog.isAuthenticatedWithGoogle({
        success: function (is_signed_in) {
          if (!is_signed_in) {
            google_account_dialog.getDialog().dialog("open");
          }
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

  function onUserNotSignedIn(client_id) {
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

  function init() {
    util.addVideoClearEvent();
    $quality_check_passed_text = $("#quality-check-passed-text");
    $user_score_text = $(".user-score-text");
    $user_raw_score_text = $(".user-raw-score-text");
    video_labeling_tool = new edaplotjs.VideoLabelingTool("#labeling-tool-container", {
      on_user_score_update: function (score, raw_score, batch_score) {
        // Update the number of batches that did not pass the quality check
        // batch_score == null means that the user is a reseacher client
        if (typeof batch_score !== "undefined" && batch_score !== null) {
          if (batch_score == 0) {
            // Fail the quality check
            $quality_check_passed_text.hide();
            consecutive_failed_batches += 1;
            if (consecutive_failed_batches >= 3) {
              tutorial_prompt_dialog.getDialog().dialog("open");
            }
          } else {
            // Pass the quality check
            $quality_check_passed_text.show();
            consecutive_failed_batches = 0;
          }
        }
        // Update user score (number of batches that passed the quality check)
        if (typeof $user_score_text !== "undefined") {
          if (video_labeling_tool.isAdmin()) {
            $user_score_text.text("(researcher)");
          } else {
            if (typeof score !== "undefined" && score !== null) {
              $user_score_text.text(score / 12);
            }
          }
        }
        // Update user raw score (number of totally reviewed batches)
        if (typeof $user_raw_score_text !== "undefined" && typeof raw_score !== "undefined" && raw_score !== null) {
          if (video_labeling_tool.isAdmin()) {
            $user_raw_score_text.text(raw_score / 16);
          } else {
            $user_raw_score_text.text(raw_score / 12);
          }
        }
      }
    });
    google_account_dialog = new edaplotjs.GoogleAccountDialog({
      sign_in_success: function (google_user) {
        video_labeling_tool.updateUserIdByGoogleIdToken(google_user.getAuthResponse().id_token, {
          success: function (obj) {
            onUserIdChangeSuccess(obj.userId());
            $sign_in_prompt.find("span").text("Sign Out");
            if ($sign_in_prompt.hasClass("pulse-white")) {
              $sign_in_prompt.removeClass("pulse-white")
            }
            $user_score_container.show();
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
            $sign_in_prompt.find("span").text("Sign In");
            if (!$sign_in_prompt.hasClass("pulse-white")) {
              $sign_in_prompt.addClass("pulse-white")
            }
            $user_score_container.hide();
          },
          error: function (xhr) {
            console.error("Error when updating user id when signing out from google!");
            printServerErrorMsg(xhr);
          }
        });
      }
    });
    $sign_in_prompt = $("#sign-in-prompt");
    $sign_in_prompt.on("click", function () {
      google_account_dialog.getDialog().dialog("open");
    });
    $user_score_container = $("#user-score-container");
    video_test_dialog = new edaplotjs.VideoTestDialog();
    tutorial_prompt_dialog = new edaplotjs.TutorialPromptDialog({
      video_labeling_tool: video_labeling_tool
    });
    ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId(),
      ready: function (client_id) {
        google_account_dialog.isAuthenticatedWithGoogle({
          success: function (is_signed_in) {
            // If signed in, will be handled by the callback function of initGoogleSignIn() in the GoogleAccountDialog object
            if (!is_signed_in) {
              onUserNotSignedIn(client_id);
            }
          },
          error: function (error) {
            console.error("Error with Google sign-in: ", error);
            onUserNotSignedIn(client_id);
          }
        });
      }
    });
    util.updateLabelStatistics();
    $("#tutorial").on("click", function () {
      // Add tutorial record based on action types
      util.postJSON(api_url_root + "add_tutorial_record", {
        "user_token": video_labeling_tool.userToken(),
        "action_type": 0, // this means that users take the tutorial
        "query_type": 1 // this means that users click the tutorial button on the webpage (not the prompt dialog)
      }, {
        success: function () {
          $("#tutorial").prop("disabled", true);
          $(location).attr("href", "tutorial.html");
        },
        error: function (xhr) {
          console.error("Error when adding tutorial record!");
        }
      });
    });
  }

  $(init);
})();