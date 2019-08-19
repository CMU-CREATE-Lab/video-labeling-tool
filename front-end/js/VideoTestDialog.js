(function () {
  "use strict";
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var VideoTestDialog = function (settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    var util = new edaplotjs.Util();
    settings = safeGet(settings, {});
    var $video_test_dialog;
    var widgets = new edaplotjs.Widgets();
    var hidden, visibilityChange;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      // The dialog for users to manually enable video autoplay
      $video_test_dialog = widgets.createCustomDialog({
        selector: "#video-test-dialog",
        show_cancel_btn: false,
        width: 270,
        show_close_button: false
      });
      $("#play-video-button").on("click", function () {
        $("video").each(function () {
          this.play();
        });
        $video_test_dialog.dialog("close");
      });
      // The code is modified from https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
      // Set the name of the hidden property and the change event for visibility
      if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
        hidden = "hidden";
        visibilityChange = "visibilitychange";
      } else if (typeof document.msHidden !== "undefined") {
        hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
      } else if (typeof document.webkitHidden !== "undefined") {
        hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
      }
      // Warn if the browser doesn't support addEventListener or the Page Visibility API
      if (typeof document.addEventListener === "undefined" || hidden === undefined) {
        console.warn("The browser does not support the Page Visibility API.");
      } else {
        // Handle page visibility change
        document.addEventListener(visibilityChange, handleVisibilityChange, false);
      }
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    // Test if the video plays
    // If not, show a dialog for users to click and play
    function videoPlayTest() {
      var is_some_video_on_screen_paused = false;
      $("video:visible").each(function () {
        var vid = $(this).get(0);
        if (isScrolledIntoView(vid) && vid.paused) {
          is_some_video_on_screen_paused = true;
          return false;
        }
      });
      if (is_some_video_on_screen_paused) {
        console.warn("Some videos on screen are paused. Give a dialog box for users to manually enable autoplay.")
        $video_test_dialog.dialog("open");
      }
    }

    // if the page is shown, attemp to play the video, and then run the check
    function handleVisibilityChange() {
      if (!document[hidden]) {
        $("video:visible").each(function () {
          var vid = $(this).get(0);
          if (vid.paused) {
            vid.play();
          }
        });
        startVideoPlayTest(1000);
      }
    }

    function isScrolledIntoView(elem) {
      var docViewTop = $(window).scrollTop();
      var docViewBottom = docViewTop + $(window).height();

      var elemTop = $(elem).offset().top;
      var elemBottom = elemTop + $(elem).height();

      return ((docViewTop < elemBottom) && (elemTop < docViewBottom));
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    var startVideoPlayTest = function (delay) {
      window.setTimeout(function () {
        if (document[hidden]) {
          console.warn("The page is hidden. Ignore video play check.");
          return;
        }
        // Check the ready state of the videos
        var is_all_video_on_screen_ready = true;
        $("video:visible").each(function () {
          var vid = $(this).get(0);
          if (isScrolledIntoView(vid) && vid.readyState != 4) {
            is_all_video_on_screen_ready = false;
            return false;
          }
        });
        if (is_all_video_on_screen_ready) {
          videoPlayTest();
        } else {
          console.warn("Some videos on screen do not have ready state 4 yet. Will test if videos play later.")
          startVideoPlayTest(delay);
        }
      }, delay);
    };
    this.startVideoPlayTest = startVideoPlayTest;

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
    window.edaplotjs.VideoTestDialog = VideoTestDialog;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.VideoTestDialog = VideoTestDialog;
  }
})();