/*
 * TODO: use different GA tracking ID for staging and production
 * TODO: add links back to the ecam webpage
 * TODO: an admin mode for only reseachers (client_type=0) to edit the label state
 */

(function () {
  "use strict";

  var google_account_dialog;
  var video_test_dialog;
  var ga_tracker;
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
  var user_token;

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
        $item.append($("<i></i>"));
      }
    } else {
      $item.append($("<i></i>"));
    }
    return $item;
  }

  function updateItem($item, v) {
    var $i = $item.find("i").removeClass();
    if (typeof user_id === "undefined") {
      if (is_admin) {
        var s = v["label_state"];
        if (s == 47) {
          $i.text("G").addClass("custom-text-primary-dark-theme");
        } else if (s == 15) {
          $i.text("M").addClass("custom-text-info-dark-theme");
        } else if (s == 23) {
          $i.text("S").addClass("custom-text-info-dark-theme");
        } else if (s == 19) {
          $i.text("W").addClass("custom-text-info-dark-theme");
        } else {
          $i.text("?").addClass("custom-text-danger-dark-theme");
        }
      }
    } else {
      var s = v["label_state"];
      if (s == 1) {
        $i.text("Y").addClass("custom-text-primary-dark-theme");
      } else if (s == 0) {
        $i.text("N").addClass("custom-text-danger-dark-theme");
      } else {
        $i.text("?").addClass("custom-text-info-dark-theme");
      }
    }
    $item.find("video").prop("src", v["url_root"] + v["url_part"] + "&labelsFromDataset");
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
      ajax: {
        type: "POST",
        data: {
          user_token: user_token
        }
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
            video_test_dialog.startVideoPlayTest(2000);
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
    google_account_dialog = new edaplotjs.GoogleAccountDialog();
    ga_tracker = new edaplotjs.Tracker({
      tracker_id: "UA-10682694-25",
      ready: function (client_id) {
        google_account_dialog.isAuthenticatedWithGoogle(function (is_signed_in, google_user) {
          if (is_signed_in) {
            login({
              google_id_token: google_user.getAuthResponse().id_token
            }, {
              success: function (data) {
                user_token = data["user_token"];
                is_admin = getJwtPayload(user_token)["client_type"] == 0 ? true : false;
              },
              complete: function () {
                initPagination();
              }
            });
          } else {
            login({
              client_id: client_id
            }, {
              success: function (data) {
                user_token = data["user_token"];
                is_admin = getJwtPayload(user_token)["client_type"] == 0 ? true : false;
              },
              complete: function () {
                initPagination();
              }
            });
          }
        });
      }
    });
    video_test_dialog = new edaplotjs.VideoTestDialog();
  }

  $(init);
})();