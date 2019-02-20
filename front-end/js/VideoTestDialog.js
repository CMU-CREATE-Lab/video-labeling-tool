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

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
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
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.startVideoPlayTest = function (delay) {
      // Give some time for the browser to load videos
      window.setTimeout(function () {
        // Test if the video plays. If not, show a dialog for users to click and play.
        var v = [];
        var t = [];
        $("video:visible").each(function () {
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
        }, delay);
      }, 1000);
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
    window.edaplotjs.VideoTestDialog = VideoTestDialog;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.VideoTestDialog = VideoTestDialog;
  }
})();