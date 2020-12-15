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
  var current_date_str = "2020-07-07";
  var current_camera_str = "2";
  var current_view_str = "all";
  var data_for_current_date;
  var video_test_dialog;
  var is_video_autoplay_tested = false;
  var $smell_pgh_link;
  var $camera_image;

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

  function secToMin(secs) {
    var m = secs / 60;
    return Math.round(m * 10) / 10;
  }

  function changeCameraImage(camera_str) {
    if ($camera_image.hasClass("cam-0-image")) {
      $camera_image.removeClass("cam-0-image");
    }
    if ($camera_image.hasClass("cam-2-image")) {
      $camera_image.removeClass("cam-2-image");
    }
    if (camera_str == "0") {
      $camera_image.addClass("cam-0-image");
      $camera_image.attr("href", "img/cam_0.png");
    } else if (camera_str == "2") {
      $camera_image.addClass("cam-2-image");
      $camera_image.attr("href", "img/cam_2.png");
    }
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
    var $control = $("<div class='label-control'></div>");
    // Add lines for displaying video metadata
    var n_lines = 4;
    for (var i = 0; i < n_lines; i++) {
      $control.append($("<p class='text-small-margin'><i></i></p>"));
    }
    $item.append($control);
    return $item;
  }

  function updateItem($item, v) {
    // Update video metadata
    var src_url = v[0];
    var $i = $item.children(".label-control").find("i").removeClass();
    var date_str = (new Date(parseInt(v[2]) * 1000)).toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour12: false
    });
    $($i.get(0)).html("<a target='_blank' href='" + util.replaceThumbnailWidth(src_url) + "'>" + date_str + "</a>");
    $($i.get(1)).text("Duration: " + secToMin(v[3] - v[2]) + " min");
    var $view_id = $($i.get(2)).text("View ID: " + v[1]);
    if (["0-1", "0-3", "0-5", "0-7", "0-8", "0-11", "0-13", "2-2", "2-3"].indexOf(v[1]) > -1) {
      $view_id.addClass("custom-text-info2-dark-theme");
    } else {
      $view_id.addClass("custom-text-info-dark-theme");
    }
    var q = util.parseVars(src_url);
    var r_split = q["root"].split("/");
    var s = r_split[5]; // camera name
    var d = r_split[6].split(".")[0]; // date
    var b = q["boundsLTRB"]; // bounds
    var t = parseInt(q["startFrame"]) / parseInt(q["fps"]); // starting time
    t = Math.round(t * 1000) / 1000
    var href = "http://mon.createlab.org/#v=" + b + ",pts&t=" + t + "&ps=25&d=" + d + "&s=" + s;
    $($i.get(3)).html("<a target='_blank' href='" + href + "'>Link to Viewer</a>");
    // Update video
    var $vid = $item.find("video");
    $vid.one("canplay", function () {
      // Play the video
      util.handleVideoPromise(this, "play");
    });
    src_url = util.replaceThumbnailWidth(src_url); // always use high resolution videos
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
        $item = createVideo();
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

  function setPagination(data_sources, desired_view_str) {
    if (typeof data_sources === "undefined") {
      onPagination();
      return false;
    }

    // Filter the urls by view ID
    var filtered_data_sources = [];
    if (desired_view_str == "all") {
      for (var k in data_sources) {
        filtered_data_sources = filtered_data_sources.concat(data_sources[k]["url"]);
      }
      // Sort by starting epochtime
      filtered_data_sources.sort(function (a, b) {
        return a[2] - b[2];
      });
    } else {
      filtered_data_sources = data_sources[desired_view_str]["url"];
    }

    // Set the pagination UI
    $page_nav = $("#page-navigator").pagination({
      dataSource: filtered_data_sources,
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
    $page_back.off().on("click", function () {
      showGalleryLoadingMsg();
      $page_nav.pagination("previous");
    });
    $page_next.off().on("click", function () {
      showGalleryLoadingMsg();
      $page_nav.pagination("next");
    });
  }

  function onPagination(data, pagination) {
    if (typeof data !== "undefined" && data.length > 0) {
      updateGallery($gallery_videos);
      updateVideos(data);
      if (!is_video_autoplay_tested) {
        video_test_dialog.startVideoPlayTest(1000);
        is_video_autoplay_tested = true;
      }
    } else {
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

  function setShareUrl(date_str, camera_str, view_str) {
    var updated_query_url = "?date=" + date_str + "&camera=" + camera_str + "&view=" + view_str;
    var replaced = window.location.protocol + "//" + window.location.hostname + window.location.pathname + updated_query_url;
    window.history.replaceState("shareURL", "Title", replaced);
  }

  function setSmellPghLink(date_str) {
    var zoom = util.isMobile() ? "11" : "10";
    var latlng = "40.405759,-79.908511";
    var url = "https://smellpgh.org/visualization?share=true&date=" + date_str.split("-").join("") + "&zoom=" + zoom + "&latLng=" + latlng + "&city_id=1";
    $smell_pgh_link.prop("href", url);
  }

  function setDateFilterDropdown(data) {
    var key_list = Object.keys(data);

    // Set current date from the query url
    var query_paras = util.parseVars(window.location.search);
    if ("date" in query_paras) {
      if (key_list.indexOf(query_paras["date"]) > -1) {
        current_date_str = query_paras["date"];
      }
    }
    if (key_list.indexOf(current_date_str) == -1) {
      current_date_str = key_list[0];
    }

    // Set date dropdown
    var $date_filter = $("#date-filter");
    for (var i = 0; i < key_list.length; i++) {
      var k = key_list[i];
      var $option;
      if (k == current_date_str) {
        $option = $('<option selected value="' + k + '">' + k + '</option>');
      } else {
        $option = $('<option value="' + k + '">' + k + '</option>');
      }
      $date_filter.append($option);
    }
    $date_filter.off().on("change", function () {
      onDateChange($(this).val());
    });

    // Set to the default date
    onDateChange(current_date_str);
  }

  function onDateChange(desired_date_str) {
    current_date_str = desired_date_str;
    $.getJSON("event/" + desired_date_str + ".json", function (data) {
      if (typeof $page_nav !== "undefined") {
        $page_nav.pagination("destroy");
      }
      setSmellPghLink(desired_date_str);
      data_for_current_date = data;
      setCameraFilterDropdown(data_for_current_date);
    }).fail(function () {
      onPagination();
    });
  }

  function setCameraFilterDropdown(data) {
    var key_list = Object.keys(data);

    // Set current camera from the query url
    var query_paras = util.parseVars(window.location.search);
    if ("camera" in query_paras) {
      if (key_list.indexOf(query_paras["camera"]) > -1) {
        current_camera_str = query_paras["camera"];
      }
    }
    if (key_list.indexOf(current_camera_str) == -1) {
      current_camera_str = key_list[0];
    }

    // Set camera dropdown
    var $camera_filter = $("#camera-filter").empty();
    for (var i = 0; i < key_list.length; i++) {
      var k = key_list[i];
      var $option;
      if (k == current_camera_str) {
        $option = $('<option selected value="' + k + '">' + k + '</option>');
      } else {
        $option = $('<option value="' + k + '">' + k + '</option>');
      }
      $camera_filter.append($option);
    }
    $camera_filter.off().on("change", function () {
      onCameraChange($(this).val());
    });

    // Set to the default camera
    onCameraChange(current_camera_str);
  }

  function onCameraChange(desired_camera_str) {
    current_camera_str = desired_camera_str;
    changeCameraImage(desired_camera_str);
    setViewFilterDropdown(data_for_current_date[desired_camera_str]["url"]);
  }

  function setViewFilterDropdown(data) {
    var key_list = Object.keys(data);

    // Set current view from the query url
    var query_paras = util.parseVars(window.location.search);
    if ("view" in query_paras) {
      if (key_list.indexOf(query_paras["view"]) > -1) {
        current_view_str = query_paras["view"];
      }
    }
    if (key_list.indexOf(current_view_str) == -1) {
      current_view_str = "all";
    }

    // Set view dropdown
    var $view_filter = $("#view-filter").empty();
    key_list.push("all");
    for (var i = 0; i < key_list.length; i++) {
      var k = key_list[i];
      var $option;
      if (k == current_view_str) {
        $option = $('<option selected value="' + k + '">' + k + '</option>');
      } else {
        $option = $('<option value="' + k + '">' + k + '</option>');
      }
      $view_filter.append($option);
    }
    $view_filter.off().on("change", function () {
      onViewChange($(this).val());
    });

    // Set to the default view
    onViewChange(current_view_str);
  }

  function onViewChange(desired_view_str) {
    current_view_str = desired_view_str;
    setPagination(data_for_current_date[current_camera_str]["url"], desired_view_str);
    setShareUrl(current_date_str, current_camera_str, desired_view_str);
    updateEventTimeLine();
  }

  function updateEventTimeLine() {
    if (current_view_str == "all") {
      drawEventTimeline(data_for_current_date[current_camera_str]["event"]);
    } else {
      drawEventTimeline(data_for_current_date[current_camera_str]["url"][current_view_str]["event"]);
    }
  }

  function correctTimestamp(original_timestamp_in_millisec) {
    // This function is used to fix the timezone problem
    // We need to consider the timezone offset difference between the browser and the US Eastern Time
    // We want to show the timeline in Eastern Time (Pittsburgh), but google chart uses local time
    var d = new Date(original_timestamp_in_millisec);
    d = moment.tz(d, "America/New_York");
    var original_timezone_offset_in_min = d.utcOffset();
    var browser_timezone_offset_in_min = -new Date().getTimezoneOffset();
    var diff_timezone_offset_in_min = original_timezone_offset_in_min - browser_timezone_offset_in_min;
    return original_timestamp_in_millisec + diff_timezone_offset_in_min * 60000;
  }

  function epochtimeToDate(epochtime) {
    return new Date(correctTimestamp(epochtime * 1000));
  }

  function copyAndReplaceHMS(date_obj, hour, minute, second) {
    var cp_date_obj = new Date(date_obj.getTime());
    cp_date_obj.setHours(hour);
    cp_date_obj.setMinutes(minute);
    cp_date_obj.setSeconds(second);
    return cp_date_obj;
  }

  function drawEventTimeline(data) {
    var container = document.getElementById("event-timeline");
    var $container = $(container);
    if (typeof data === "undefined" || data.length == 0) {
      $container.hide();
      return false;
    }
    $container.empty().show(); // need this line to resize properly
    var data_rows = [];
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] > data[i][1]) {
        // Skip if the starting time is larger than ending time
        // Not sure why this happens, weired...
        continue;
      }
      data_rows.push(["Event", epochtimeToDate(data[i][0]), epochtimeToDate(data[i][1])]);
    }

    var chart = new google.visualization.Timeline(container);
    var dataTable = new google.visualization.DataTable();
    dataTable.addColumn({
      type: "string",
      id: "Event"
    });
    dataTable.addColumn({
      type: "date",
      id: "Start"
    });
    dataTable.addColumn({
      type: "date",
      id: "End"
    });
    dataTable.addRows(data_rows);

    var options = {
      timeline: {
        showRowLabels: false,
        showBarLabels: false,
        singleColor: "#666"
      },
      avoidOverlappingGridLines: false,
      tooltip: {
        trigger: false
      },
      height: 140,
      width: "100%",
      enableInteractivity: false,
      hAxis: {
        format: "h a",
        minValue: copyAndReplaceHMS(data_rows[0][1], 6, 0, 0), // 6 am
        maxValue: copyAndReplaceHMS(data_rows[0][1], 21, 0, 0) // 9 pm
      }
    };
    google.visualization.events.addListener(chart, "ready", function () {
      var labels = container.getElementsByTagName("text");
      Array.prototype.forEach.call(labels, function (label) {
        if (["middle", "start", "end"].indexOf(label.getAttribute("text-anchor")) > -1) {
          label.setAttribute("fill", "#ffffff");
          label.setAttribute("y", label.getAttribute("y") - 5);
          label.setAttribute("font-weight", "normal");
          label.setAttribute("font-family", "'Source Sans Pro', Arial");
        }
      });
      var divs = container.getElementsByTagName("div");
      Array.prototype.forEach.call(divs, function (div) {
        if (div.getAttribute("dir") === "ltr") {
          $(div).css("height", "60px");
        }
      });
      var svgs = container.getElementsByTagName("svg");
      Array.prototype.forEach.call(svgs, function (svg) {
        svg.setAttribute("height", "60");
      });
    });
    chart.draw(dataTable, options);
  }

  function init() {
    util.addVideoClearEvent();
    $page_control = $("#page-control");
    $page_back = $("#page-back");
    $page_next = $("#page-next");
    $gallery = $(".gallery");
    $gallery_videos = $(".gallery-videos");
    $smell_pgh_link = $("#smell-pgh-link");
    $camera_image = $("#camera-image");

    // Check browser support
    if (util.browserSupported()) {
      showGalleryLoadingMsg();
    } else {
      console.warn("Browser not supported.");
      showGalleryNotSupportedMsg();
      return;
    }

    // Set video testing
    video_test_dialog = new edaplotjs.VideoTestDialog();

    // Set Google Analytics
    var ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId()
    });

    // Load the Visualization API and the timeline package.
    google.charts.load("current", {
      packages: ["timeline"]
    });

    // Set a callback to run when the Google Visualization API is loaded.
    google.charts.setOnLoadCallback(function () {
      // Load event data
      $.getJSON("event/event_metadata.json", function (data) {
        setDateFilterDropdown(data);
      });
    });

    // Resize the timeline chart when window size changes
    $(window).resize(function () {
      updateEventTimeLine();
    });
  }

  $(init);
})();