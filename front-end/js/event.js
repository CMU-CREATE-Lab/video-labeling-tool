(function () {
  "use strict";

  var util = new edaplotjs.Util();
  var $gallery_no_data_text = $('<span class="gallery-no-data-text">No videos are found.</span>');
  var $gallery_error_text = $('<span class="gallery-error-text">Oops!<br>Server may be down or busy.<br>Please come back later.</span>');
  var $gallery_loading_text = $('<span class="gallery-loading-text"></span>');
  var $gallery_not_supported_text = $('<span class="gallery-not-supported-text">We are sorry!<br>Your browser is not supported.</span>');
  var $gallery;
  var $gallery_videos;
  var video_items = [];
  var $page_nav;
  var $page_back;
  var $page_next;
  var $page_control;
  var current_view_id = "0-2";
  var current_date_str = "2019-03-26";

  function updateGallery($new_content) {
    $gallery_videos.detach(); // detatch prevents the click event from being removed
    $gallery.empty().append($new_content);
  }

  function showNoGalleryMsg() {
    updateGallery($gallery_no_data_text);
  }

  function showGalleryErrorMsg() {
    updateGallery($gallery_error_text);
  }

  function showGalleryLoadingMsg() {
    updateGallery($gallery_loading_text);
  }

  function showGalleryNotSupportedMsg() {
    updateGallery($gallery_not_supported_text);
  }

  // Create a video label element
  // IMPORTANT: Safari on iPhone only allows displaying maximum 16 videos at once
  // UPDATE: starting from Safari 12, more videos are allowed
  function createVideo() {
    var $item = $("<a class='flex-column'></a>");
    // "autoplay" is needed for iPhone Safari to work
    // "preload" is ignored by mobile devices
    // "disableRemotePlayback" prevents chrome casting
    // "playsinline" and "playsInline" prevents playing video fullscreen
    var $vid = $("<video autoplay loop muted playsinline playsInline disableRemotePlayback></video>");
    $item.append($vid);
    return $item;
  }

  function updateItem($item, src_url) {
    // Update date and time information
    var $vid = $item.find("video");
    $vid.one("canplay", function () {
      // Play the video
      util.handleVideoPromise(this, "play");
    });
    // There is a bug that the edge of small videos have weird artifacts on Google Pixel Android 9 and 10.
    // The current workaround is to make the thumbnail larger.
    if (util.getAndroidVersion() >= 9) {
      src_url = util.replaceThumbnailWidth(src_url);
    }
    $vid.prop("src", src_url);
    util.handleVideoPromise($vid.get(0), "load"); // load to reset video promise
    return $item;
  }

  function updateVideos(video_data) {
    // Add videos
    for (var i = 0; i < video_data.length; i++) {
      var v = video_data[i];
      var $item;
      if (typeof video_items[i] === "undefined") {
        $item = createVideo(v);
        video_items.push($item);
        $gallery_videos.append($item);
      } else {
        $item = video_items[i];
      }
      $item = updateItem($item, v);
      if ($item.hasClass("force-hidden")) {
        $item.removeClass("force-hidden");
      }
    }
    // Hide exceeding videos
    for (var i = video_data.length; i < video_items.length; i++) {
      var $item = video_items[i];
      if (!$item.hasClass("force-hidden")) {
        $item.addClass("force-hidden");
      }
    }
  }

  function setPagination(data_sources) {
    if (typeof data_sources === "undefined") {
      onPagination();
      return false;
    }
    $page_nav = $("#page-navigator").pagination({
      dataSource: data_sources,
      className: "paginationjs-custom",
      pageSize: 16,
      showPageNumbers: false,
      showNavigator: true,
      showGoInput: true,
      showGoButton: true,
      showPrevious: false,
      showNext: false,
      callback: function (data, pagination) {
        onPagination(data, pagination);
      }
    });
    $page_back.on("click", function () {
      showGalleryLoadingMsg();
      $page_nav.pagination("previous");
    });
    $page_next.on("click", function () {
      showGalleryLoadingMsg();
      $page_nav.pagination("next");
    });
  }

  function onPagination(data, pagination) {
    if (typeof data !== "undefined" && data.length > 0) {
      $(window).scrollTop(0);
      updateGallery($gallery_videos);
      updateVideos(data);
    } else {
      $(window).scrollTop(0);
      showNoGalleryMsg();
    }
    // Handle UI
    if (typeof pagination === "undefined") {
      if (!$page_control.hasClass("force-hidden")) {
        $page_control.addClass("force-hidden");
      }
      return false;
    }
    var total_page = Math.ceil(pagination["totalNumber"] / pagination["pageSize"]);
    if (typeof total_page !== "undefined" && !isNaN(total_page) && total_page > 1) {
      if ($page_control.hasClass("force-hidden")) {
        $page_control.removeClass("force-hidden");
      }
      var page_num = pagination["pageNumber"];
      if (page_num == 1) {
        $page_back.prop("disabled", true);
      } else {
        $page_back.prop("disabled", false);
      }
      if (page_num == total_page) {
        $page_next.prop("disabled", true);
      } else {
        $page_next.prop("disabled", false);
      }
    } else {
      if (!$page_control.hasClass("force-hidden")) {
        $page_control.addClass("force-hidden");
      }
    }
  }

  function setDateFilterDropdown(date_list) {
    if (date_list.indexOf(current_date_str) == -1) {
      current_date_str = undefined;
    }
    var $date_filter = $("#date-filter");
    for (var i = 0; i < date_list.length; i++) {
      var k = date_list[i]
      var $option;
      if (typeof current_date_str === "undefined") {
        $option = $('<option selected value="' + k + '">' + k + '</option>');
        current_date_str = k;
      } else {
        if (k == current_date_str) {
          $option = $('<option selected value="' + k + '">' + k + '</option>');
        } else {
          $option = $('<option value="' + k + '">' + k + '</option>');
        }
      }
      $date_filter.append($option);
    }
    $date_filter.off().on("change", function () {
      onDateChange($(this).val());
    });
    onDateChange(current_date_str);
  }

  function onDateChange(desired_date_str) {
    current_date_str = desired_date_str;
    $.getJSON("event/" + desired_date_str + ".json", function (event_data) {
      setViewFilterDropdown(event_data)
    }).fail(function () {
      onPagination();
    });
  }

  function setViewFilterDropdown(event_data) {
    var event_data_keys = Object.keys(event_data);
    if (event_data_keys.indexOf(current_view_id) == -1) {
      current_view_id = undefined;
    }
    var $view_filter = $("#view-filter").empty();
    for (var i = 0; i < event_data_keys.length; i++) {
      var k = event_data_keys[i];
      var $option;
      if (typeof current_view_id === "undefined") {
        $option = $('<option selected value="' + k + '">' + k + '</option>');
        current_view_id = k;
      } else {
        if (k == current_view_id) {
          $option = $('<option selected value="' + k + '">' + k + '</option>');
        } else {
          $option = $('<option value="' + k + '">' + k + '</option>');
        }
      }
      $view_filter.append($option);
    }
    $view_filter.off().on("change", function () {
      onViewChange($(this).val(), event_data);
    });
    onViewChange(current_view_id, event_data);
  }

  function onViewChange(desired_view_id, event_data) {
    current_view_id = desired_view_id;
    if (typeof $page_nav !== "undefined") {
      $page_nav.pagination("destroy");
      $page_back.off();
      $page_next.off();
    }
    setPagination(event_data[desired_view_id]);
  }

  function init() {
    $page_control = $("#page-control");
    $page_back = $("#page-back");
    $page_next = $("#page-next");
    util.addVideoClearEvent();
    $gallery = $(".gallery");
    $gallery_videos = $(".gallery-videos");
    if (util.browserSupported()) {
      showGalleryLoadingMsg();
    } else {
      console.warn("Browser not supported.");
      showGalleryNotSupportedMsg();
    }
    $.getJSON("event/date_list.json", function (date_list) {
      setDateFilterDropdown(date_list);
    });
  }

  $(init);
})();