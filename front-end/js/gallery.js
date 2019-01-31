/*
 * TODO: add links back to the ecam webpage
 * TODO: an admin mode for only reseachers (client_type=0) to edit the label state
 */

(function () {
  "use strict";

  var google_account_dialog;
  var video_test_dialog;
  var api_url_root = getRootApiUrl();
  var api_url_path = "get_pos_labels";
  var $gallery_no_data_text = $('<span class="gallery-no-data-text">No videos are found.</span>');
  var $gallery_error_text = $('<span class="gallery-error-text">Oops!<br>Server may be down or busy.<br>Please come back later.</span>');
  var $gallery;
  var $gallery_videos;
  var video_items = [];
  var $page_nav;
  var $page_back;
  var $page_next;
  var $page_control;
  var is_first_time = true;
  var user_id;
  var is_admin = false;

  function unpackVars(str) {
    var vars = {};
    if (str) {
      var keyvals = str.split(/[#?&]/);
      for (var i = 0; i < keyvals.length; i++) {
        var keyval = keyvals[i].split('=');
        vars[keyval[0]] = keyval[1];
      }
    }
    // Delete null/undefined values
    Object.keys(vars).forEach(function (key) {
      return (vars[key] == null || key == "") && delete vars[key];
    });
    return vars;
  };

  // Get the the root url of the API
  function getRootApiUrl() {
    var root_url;
    var url_hostname = window.location.hostname;
    var is_localhost = url_hostname.indexOf("localhost");
    var is_staging = url_hostname.indexOf("staging");
    if (is_localhost >= 0) {
      root_url = "http://localhost:5000/api/v1/";
    } else {
      if (is_staging >= 0) {
        root_url = "http://staging.api.smoke.createlab.org/api/v1/";
      } else {
        root_url = "http://api.smoke.createlab.org/api/v1/";
      }
    }
    return root_url;
  }

  // Get the parameters from the query string
  function getQueryParas() {
    return unpackVars(window.location.search);
  }

  function showNoGalleryMsg() {
    $gallery_videos.detach();
    $gallery.empty().append($gallery_no_data_text);
  }

  function showGalleryErrorMsg() {
    $gallery_videos.detach();
    $gallery.empty().append($gallery_error_text);
  }

  function createVideo(v) {
    var $item = $("<a href='javascript:void(0)' class='flex-column'></a>");
    var $vid = $("<video autoplay preload loop muted playsinline></video>");
    $item.append($vid);
    if (typeof user_id === "undefined") {
      if (is_admin) {
        var s = v["label_state"];
        if (s == 47) {
          $item.append($("<i>G</i>").addClass("custom-text-primary-dark-theme"));
        } else if (s == 15) {
          $item.append($("<i>M</i>").addClass("custom-text-info-dark-theme"));
        } else if (s == 23) {
          $item.append($("<i>S</i>").addClass("custom-text-info-dark-theme"));
        } else if (s == 19) {
          $item.append($("<i>W</i>").addClass("custom-text-info-dark-theme"));
        } else {
          $item.append($("<i>?</i>").addClass("custom-text-danger-dark-theme"));
        }
      }
    } else {
      var s = v["label_state"];
      if (s == 1) {
        $item.append($("<i>Y</i>").addClass("custom-text-primary-dark-theme"));
      } else if (s == 0) {
        $item.append($("<i>N</i>").addClass("custom-text-danger-dark-theme"));
      } else {
        $item.append($("<i>?</i>").addClass("custom-text-info-dark-theme"));
      }
    }
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
      var $vid = $item.find("video");
      $vid.prop("src", v["url_root"] + v["url_part"] + "&labelsFromDataset");
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
    // Show videos
    $gallery.empty().append($gallery_videos);
  }

  function initPagination() {
    $page_nav = $("#page-navigator");
    $page_control = $("#page-control");
    $page_nav.pagination({
      dataSource: api_url_root + api_url_path,
      locator: "data",
      totalNumberLocator: function (response) {
        if (typeof response === "undefined") {
          showNoGalleryMsg();
        } else {
          return parseInt(response["total"]);
        }
      },
      formatAjaxError: function () {
        showGalleryErrorMsg();
      },
      className: "paginationjs-custom",
      pageSize: 16,
      showPageNumbers: false,
      showNavigator: true,
      showGoInput: false,
      showGoButton: false,
      showPrevious: false,
      showNext: false,
      callback: function (data, pagination) {
        if (typeof data !== "undefined" && data.length > 0) {
          $(window).scrollTop(0);
          updateVideos(data);
          if (is_first_time) {
            video_test_dialog.startVideoPlayTest(4000);
            is_first_time = false;
          }
        } else {
          $(window).scrollTop(0);
          showNoGalleryMsg();
        }
        // Handle UI
        var total_page = $page_nav.pagination("getTotalPage");
        if (typeof total_page !== "undefined" && !isNaN(total_page) && total_page != 1) {
          if ($page_control.hasClass("init-hidden")) {
            $page_control.removeClass("init-hidden");
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
        }
      }
    });
    $page_back = $("#page-back");
    $page_back.on("click", function () {
      $page_nav.pagination("previous");
    });
    $page_next = $("#page-next");
    $page_next.on("click", function () {
      $page_nav.pagination("next");
    });
  }

  function login(post_json, callback) {
    callback = safeGet(callback, {});
    $.ajax({
      url: api_url_root + "login",
      type: "POST",
      data: JSON.stringify(post_json),
      contentType: "application/json",
      dataType: "json",
      success: function (data) {
        if (typeof callback["success"] === "function") callback["success"](data);
      },
      error: function (xhr) {
        if (typeof callback["error"] === "function") callback["error"](xhr);
      },
      complete: function () {
        if (typeof callback["complete"] === "function") callback["complete"]();
      }
    });
  }

  // Safely get the value from a variable, return a default value if undefined
  function safeGet(v, default_val) {
    if (typeof default_val === "undefined") default_val = "";
    return (typeof v === "undefined") ? default_val : v;
  }

  // Read the payload in a JWT
  function getJwtPayload(jwt) {
    return JSON.parse(window.atob(jwt.split('.')[1]));
  }

  function init() {
    $gallery = $(".gallery");
    $gallery_videos = $(".gallery-videos");
    user_id = getQueryParas()["user_id"];
    if (typeof user_id !== "undefined") {
      api_url_path += "?user_id=" + user_id;
      $(".intro-text").hide();
      $(".user-text").show();
    };
    google_account_dialog = new edaplotjs.GoogleAccountDialog({
      sign_in_success_callback: function (google_user) {
        login({
          google_id_token: google_user.getAuthResponse().id_token
        }, {
          success: function (data) {
            var payload = getJwtPayload(data["user_token"]);
            if (payload["client_type"] == 0) {
              is_admin = true;
            }
          },
          complete: function () {
            console.log("complete");
          }
        });
      },
      sign_out_success_callback: function () {
        console.log("sign_out_success_callback");
      }
    });
    video_test_dialog = new edaplotjs.VideoTestDialog();
    initPagination();
  }

  $(init);
})();