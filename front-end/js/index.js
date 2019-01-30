(function () {
  "use strict";

  var video_labeling_tool;
  var widgets = new edaplotjs.Widgets();
  var $next;
  var counter = 0;
  var max_counter = 10;
  var count_down_duration = 500; // in milliseconds
  var $google_sign_out_button;
  var $google_sign_in_button;
  var $guest_button;
  var $account_dialog;
  var $video_test_dialog;
  var $sign_in_text;
  var $hello_text;
  var is_first_time = true;

  function onGoogleSignInSuccess(googleUser) {
    var profile = googleUser.getBasicProfile();
    $guest_button.hide();
    $google_sign_out_button.show();
    $hello_text.text("Hi " + profile.getGivenName() + ", thank you for signing in with Google.").show();
    $sign_in_text.hide();
    $google_sign_in_button.hide();
    $account_dialog.dialog("close");
    video_labeling_tool.updateUserIdByGoogleIdToken(googleUser.getAuthResponse().id_token, {
      success: function (obj) {
        onUserIdChangeSuccess(obj.userId());
      },
      error: function (xhr) {
        console.error("Error when updating user id by using google token!");
        printServerErrorMsg(xhr);
      }
    });
  }

  function onGoogleSignOutSuccess() {
    $google_sign_out_button.hide();
    $google_sign_in_button.show();
    $guest_button.show();
    $sign_in_text.show();
    $hello_text.hide();
    var $content = $google_sign_in_button.find(".abcRioButtonContents");
    var $hidden = $content.find(":hidden");
    var $visible = $content.find(":visible");
    $hidden.show();
    $visible.hide();
    video_labeling_tool.updateUserIdByClientId({
      success: function (obj) {
        onUserIdChangeSuccess(obj.userId());
      },
      error: function (xhr) {
        console.error("Error when updating user id when signing out from google!");
        printServerErrorMsg(xhr);
      }
    });
  }

  function googleSignOut(callback) {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
      auth2.disconnect();
      // User signed out successfully
      if (typeof callback === "function") callback();
    });
  }

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

  function nextBatch() {
    $next.prop("disabled", true);
    $(window).scrollTop(0);
    video_labeling_tool.next({
      success: function () {
        countDown();
      },
      abort: function () {
        $next.prop("disabled", false);
      }
    });
  }

  function setReviewLink(user_id) {
    $("#review").prop("href", "gallery.html" + "?user_id=" + user_id);
  }

  function printServerErrorMsg(xhr) {
    console.error("Server respond: " + JSON.stringify(xhr.responseJSON));
  }

  function printServerWarnMsg(xhr) {
    console.warn("Server respond: " + JSON.stringify(xhr.responseJSON));
  }

  function onUserIdChangeSuccess(new_user_id) {
    setReviewLink(new_user_id);
    if (is_first_time) {
      $next = $("#next");
      $("#start").on("click", function () {
        nextBatch();
        $next.on("click", function () {
          nextBatch();
        });
        $(".init-hidden").removeClass("init-hidden");
        $(".init-show").css("display", "none");
      });
      isAuthenticatedWithGoogle(function (is_signed_in) {
        if (is_signed_in) {
          startVideoPlayTest();
        } else {
          $account_dialog.dialog("open");
          $account_dialog.one("dialogclose", function () {
            startVideoPlayTest();
          });
        }
      });
      is_first_time = false;
    }
  }

  var isAuthenticatedWithGoogle = function (callback) {
    if (typeof gapi !== "undefined" && typeof gapi.auth2 === "undefined") {
      gapi.load("auth2", function () {
        gapi.auth2.init().then(function () {
          return isAuthenticatedWithGoogle(callback);
        });
      });
    } else {
      if (typeof callback === "function") {
        callback(gapi.auth2.getAuthInstance().isSignedIn.get());
      }
    }
  };

  function initGoogleSignIn() {
    $sign_in_text = $("#sign-in-text");
    $hello_text = $("#hello-text");
    $google_sign_out_button = $("#google-sign-out-button");
    $google_sign_in_button = $("#google-sign-in-button");
    $guest_button = $("#guest-button");
    $google_sign_out_button.on("click", function () {
      googleSignOut(onGoogleSignOutSuccess);
    });
    $guest_button.on("click", function () {
      $account_dialog.dialog("close");
    });
    renderGoogleSignInButton();
  }

  function renderGoogleSignInButton() {
    gapi.signin2.render("google-sign-in-button", {
      scope: "profile email",
      width: 231,
      height: 46,
      longtitle: true,
      theme: "dark",
      onsuccess: onGoogleSignInSuccess
    });
  }

  function initAccountDialog() {
    $account_dialog = widgets.createCustomDialog({
      selector: "#account-dialog",
      no_body_scroll: true,
      show_cancel_btn: false,
      width: 270
    });
    $("#account").on("click", function () {
      $account_dialog.dialog("open");
    });
  }

  function initVideoTestDialog() {
    $video_test_dialog = widgets.createCustomDialog({
      selector: "#video-test-dialog",
      no_body_scroll: true,
      show_cancel_btn: false,
      width: 270
    });
    $video_test_dialog.on("dialogopen", function () {
      $(this).parent().find(".ui-dialog-titlebar-close").hide();
    });
    $("#play-video-button").on("click", function () {
      $("video").each(function () {
        this.play();
      });
      $video_test_dialog.dialog("close");
    });
  }

  // Test if the video plays. If not, show a dialog for users to click and play.
  function startVideoPlayTest() {
    var v = [];
    var t = [];
    $("video").each(function () {
      var element = $(this).get(0);
      v.push(element);
      t.push(element.currentTime);
    });
    window.setTimeout(function () {
      var is_autoplay_enabled = false;
      for (var i = 0; i < v.length; i++) {
        if (v[i].currentTime != t[i]) {
          is_autoplay_enabled = true;
          break;
        }
      }
      if (!is_autoplay_enabled) {
        $video_test_dialog.dialog("open");
      }
    }, 1000);
  }

  function init() {
    video_labeling_tool = new edaplotjs.VideoLabelingTool("#labeling-tool-container");
    initAccountDialog();
    initVideoTestDialog();
    initGoogleSignIn();
    var ga_tracker = new edaplotjs.Tracker({
      tracker_id: "UA-10682694-25",
      ready: function (client_id) {
        isAuthenticatedWithGoogle(function (is_signed_in) {
          // If signed in, will be handled by the onGoogleSignInSuccess function
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