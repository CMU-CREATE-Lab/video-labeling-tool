(function () {
  "use strict";
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var GoogleAccountDialog = function (settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    settings = safeGet(settings, {});
    var $account_dialog;
    var $google_sign_out_button;
    var $google_sign_in_button;
    var $guest_button;
    var $sign_in_text;
    var $hello_text;
    var widgets = new edaplotjs.Widgets();
    var sign_in_success_callback = settings["sign_in_success_callback"];
    var sign_out_success_callback = settings["sign_out_success_callback"];

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $account_dialog = widgets.createCustomDialog({
        selector: "#account-dialog",
        no_body_scroll: true,
        show_cancel_btn: false,
        width: 270
      });
      $("#account").on("click", function () {
        $account_dialog.dialog("open");
      });
      initGoogleSignIn();
    }

    function initGoogleSignIn() {
      $sign_in_text = $("#sign-in-text");
      $hello_text = $("#hello-text");
      $google_sign_out_button = $("#google-sign-out-button");
      $google_sign_in_button = $("#google-sign-in-button");
      $guest_button = $("#guest-button");
      $google_sign_out_button.on("click", function () {
        googleSignOut();
      });
      $guest_button.on("click", function () {
        $account_dialog.dialog("close");
      });
      renderGoogleSignInButton();
    }

    function googleSignOut() {
      var auth2 = gapi.auth2.getAuthInstance();
      auth2.signOut().then(function () {
        auth2.disconnect();
        onGoogleSignOutSuccess();
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
      if (typeof sign_out_success_callback === "function") {
        sign_out_success_callback();
      }
    }

    function renderGoogleSignInButton() {
      gapi.signin2.render("google-sign-in-button", {
        scope: "profile email",
        width: 231,
        height: 46,
        longtitle: true,
        theme: "dark",
        onsuccess: function (google_user) {
          onGoogleSignInSuccess(google_user);
        }
      });
    }

    function onGoogleSignInSuccess(google_user) {
      var profile = google_user.getBasicProfile();
      $guest_button.hide();
      $google_sign_out_button.show();
      $hello_text.text("Hi " + profile.getGivenName() + ", thank you for signing in with Google.").show();
      $sign_in_text.hide();
      $google_sign_in_button.hide();
      $account_dialog.dialog("close");
      if (typeof sign_in_success_callback === "function") {
        sign_in_success_callback(google_user);
      }
    }

    // Safely get the value from a variable, return a default value if undefined
    function safeGet(v, default_val) {
      if (typeof default_val === "undefined") default_val = "";
      return (typeof v === "undefined") ? default_val : v;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    var isAuthenticatedWithGoogle = function (callback) {
      if (typeof gapi !== "undefined" && typeof gapi.auth2 === "undefined") {
        gapi.load("auth2", function () {
          gapi.auth2.init().then(function () {
            return isAuthenticatedWithGoogle(callback);
          });
        });
      } else {
        if (typeof callback === "function") {
          var auth2 = gapi.auth2.getAuthInstance();
          var is_signed_in = auth2.isSignedIn.get();
          if (is_signed_in) {
            callback(is_signed_in, auth2.currentUser.get());
          } else {
            callback(is_signed_in);
          }
        }
      }
    };
    this.isAuthenticatedWithGoogle = isAuthenticatedWithGoogle;

    this.getDialog = function () {
      return $account_dialog;
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Constructor
    //
    init();
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Register to window
  //
  if (window.edaplotjs) {
    window.edaplotjs.GoogleAccountDialog = GoogleAccountDialog;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.GoogleAccountDialog = GoogleAccountDialog;
  }
})();