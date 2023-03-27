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
    var util = new edaplotjs.Util();
    settings = safeGet(settings, {});
    var $account_dialog;
    var $google_sign_out_button;
    var $google_sign_in_button;
    var $guest_button;
    var $sign_in_text;
    var $hello_text;
    var $user_name_text;
    var $use_id_text;
    var widgets = new edaplotjs.Widgets();
    var sign_in_success = settings["sign_in_success"];
    var sign_out_success = settings["sign_out_success"];
    var no_ui = safeGet(settings["no_ui"], false);

    // Client ID and API key from the Developer Console
    var CLIENT_ID = "231059631125-7purhi103qml7hapjnetmrmcrr4jff0f.apps.googleusercontent.com";

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      if (no_ui) {
        return;
      }
      $account_dialog = widgets.createCustomDialog({
        selector: "#account-dialog",
        show_cancel_btn: false,
        width: 270
      });
      initGoogleSignIn();
    }

    function initGoogleSignIn() {
      $sign_in_text = $("#sign-in-text");
      $hello_text = $("#hello-text");
      $user_name_text = $("#user-name-text");
      $use_id_text = $("#user-id-text");
      $google_sign_out_button = $("#google-sign-out-button");
      $google_sign_in_button = $("#google-sign-in-button");
      $guest_button = $("#guest-button");
      $google_sign_out_button.on("click", function () {
        googleSignOut();
      });
      $guest_button.on("click", function () {
        $account_dialog.dialog("close");
      });
      google.accounts.id.initialize({
        client_id: CLIENT_ID,
        auto_select: true,
        callback: handleCredentialResponse
      });
      renderGoogleSignInButton();
    }

    function handleCredentialResponse(googleUser) {
      var google_id_token = googleUser["credential"];
      window.localStorage.setItem("google_id_token", google_id_token);
      onGoogleSignInSuccess(google_id_token);
    }

    function googleSignOut() {
      window.localStorage.removeItem("google_id_token");
      onGoogleSignOutSuccess();
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
      if (typeof sign_out_success === "function") {
        sign_out_success();
      }
    }

    function renderGoogleSignInButton() {
      google.accounts.id.renderButton(document.getElementById("google-sign-in-button"), {
        theme: "filled_blue",
        width: 231,
        height: 46
      })
    }

    function onGoogleSignInSuccess(google_id_token) {
      if (typeof $guest_button !== "undefined") {
        $guest_button.hide();
      }
      if (typeof $google_sign_out_button !== "undefined") {
        $google_sign_out_button.show();
      }
      if (typeof $user_name_text !== "undefined") {
        var google_id_token_obj = jwt_decode(google_id_token);
        $user_name_text.text(google_id_token_obj["given_name"]);
      }
      if (typeof $hello_text !== "undefined") {
        $hello_text.show();
      }
      if (typeof $sign_in_text !== "undefined") {
        $sign_in_text.hide();
      }
      if (typeof $google_sign_in_button !== "undefined") {
        $google_sign_in_button.hide();
      }
      if (typeof $account_dialog !== "undefined") {
        $account_dialog.dialog("close");
      }
      if (typeof sign_in_success === "function") {
        sign_in_success(google_id_token);
      }
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    var isAuthenticatedWithGoogle = function (callback) {
      callback = safeGet(callback, {});
      var google_id_token = window.localStorage.getItem("google_id_token");
      var is_signed_in = google_id_token == null ? false : true;
      if (is_signed_in) {
        onGoogleSignInSuccess(google_id_token);
        callback["success"](is_signed_in, google_id_token);
      } else {
        callback["success"](is_signed_in);
      }
    };
    this.isAuthenticatedWithGoogle = isAuthenticatedWithGoogle;

    this.silentSignInWithGoogle = function (callback) {
      isAuthenticatedWithGoogle(callback);
    };

    this.getDialog = function () {
      return $account_dialog;
    };

    this.updateUserId = function (user_id) {
      if (typeof $use_id_text !== "undefined") {
        if (typeof user_id !== "undefined") {
          $use_id_text.text(user_id);
        } else {
          $use_id_text.text("(unknown)");
        }
      }
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