(function () {
  "use strict";

  var util = new edaplotjs.Util();
  var is_video_autoplay_tested = false;
  var api_url_root = util.getRootApiUrl();

  function init() {
    var video_test_dialog = new edaplotjs.VideoTestDialog();
    if (!is_video_autoplay_tested) {
      video_test_dialog.startVideoPlayTest(1000);
      is_video_autoplay_tested = true;
    }
    var ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId()
    });
    $.getJSON(api_url_root + "get_label_statistics", function (data) {
      var num_all_videos = data["num_all_videos"];
      $(".num-all-videos-text").text(num_all_videos);
      var num_fully_labeled = data["num_fully_labeled"];
      var num_fully_labeled_p = Math.round(num_fully_labeled / num_all_videos * 10000) / 100;
      $(".num-fully-labeled-text").text(num_fully_labeled + " (" + num_fully_labeled_p + "%)");
      var num_partially_labeled = data["num_partially_labeled"];
      var num_partially_labeled_p = Math.round(num_partially_labeled / num_all_videos * 10000) / 100;
      $(".num-partially-labeled-text").text(num_partially_labeled + " (" + num_partially_labeled_p + "%)");
      $("#label-statistics").show();
    });
  }

  $(init);
})();