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
    var should_do_video_play_test = true;

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
        $("video:visible").each(function () {
          this.playPromise = this.play();
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
      // Add a scroll event to the document to play videos that are in view
      // , and pause videos that are not in view
      $(document).on("scroll", function () {
        $("video:visible").each(function () {
          var vid = $(this)[0];
          if (util.isScrolledIntoView(vid)) {
            if (vid.paused) {
              util.handleVideoPromise(vid, "play", function () {
                startVideoPlayTest(1000);
              });
            }
          } else {
            if (!vid.paused) {
              util.handleVideoPromise(vid, "pause");
            }
          }
        });
      });
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    // If the page is shown, attemp to play the video, and then run the check
    function handleVisibilityChange() {
      if (!document[hidden]) {
        should_do_video_play_test = true;
        // Attemp to play the videos that are in view
        $("video:visible").each(function () {
          var vid = $(this).get(0);
          if (util.isScrolledIntoView(vid)) {
            util.handleVideoPromise(vid, "play");
          }
        });
        startVideoPlayTest(1000);
      }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    var startVideoPlayTest = function (delay) {
      if (!should_do_video_play_test) return;
      should_do_video_play_test = false;
      // We need this timeout to properly get document[hidden]
      setTimeout(function () {
        // Check if the page is hidden
        if (document[hidden]) {
          console.warn("The page is hidden. Ignore video play check.");
          should_do_video_play_test = true;
          return;
        }
        var $videos = $("video:visible");
        // Check if videos on screen are ready to play
        // Check if there is at least one video on screen
        var is_at_least_one_video_on_screen = false;
        var is_all_videos_on_screen_ready_to_play = true;
        $videos.each(function () {
          var vid = $(this).get(0);
          if (util.isScrolledIntoView(vid)) {
            is_at_least_one_video_on_screen = true;
            if (vid.readyState < 2) {
              is_all_videos_on_screen_ready_to_play = false;
              return false;
            }
          }
        });
        if (!is_at_least_one_video_on_screen) {
          console.warn("No videos are on screen. The video play test will be handeled by the scroll event if video autoplay errors occur.");
          should_do_video_play_test = true;
          return;
        }
        if (!is_all_videos_on_screen_ready_to_play) {
          console.warn("Some videos on the screen are not ready to play, will try the video play test later.");
          setTimeout(function () {
            should_do_video_play_test = true;
            startVideoPlayTest(1000);
          }, 5000);
          return;
        }
        // Check if videos on screen plays
        var is_all_video_on_screen_playing = true;
        $videos.each(function () {
          var vid = $(this).get(0);
          if (util.isScrolledIntoView(vid) && vid.paused) {
            is_all_video_on_screen_playing = false;
            return false;
          }
        });
        if (!is_all_video_on_screen_playing) {
          // If not, show a dialog for users to click and play
          console.warn("Video autoplay is disabled. Give a dialog box for users to manually enable autoplay.");
          $video_test_dialog.dialog("open");
        } else {
          console.log("Video autoplay is enabled. Great!");
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