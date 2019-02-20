(function () {
  "use strict";

  var util = new edaplotjs.Util();

  function init() {
    var video_test_dialog = new edaplotjs.VideoTestDialog();
    video_test_dialog.startVideoPlayTest(2000);
    var ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId()
    });
  }

  $(init);
})();