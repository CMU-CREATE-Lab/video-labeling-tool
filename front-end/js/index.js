(function () {
  "use strict";

  var util = new edaplotjs.Util();

  function init() {
    var video_test_dialog = new edaplotjs.VideoTestDialog();
    var ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId()
    });
  }

  $(init);
})();