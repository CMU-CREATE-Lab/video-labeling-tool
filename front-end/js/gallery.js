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
  var widgets = new edaplotjs.Widgets();
  var api_url_root = getRootApiUrl();
  var api_url_path_get = "get_pos_labels";
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
  var label_state_map = {
    "47": "Gold Pos",
    "32": "Gold Neg",
    "23": "Strong Pos",
    "16": "Strong Neg",
    "20": "Weak Neg",
    "19": "Weak Pos",
    "15": "Medium Pos",
    "12": "Medium Neg"
  };
  var label_map = {
    "11": "Gold Pos",
    "10": "Gold Neg",
    "1": "Strong Pos",
    "0": "Strong Neg"
  };
  var $set_label_confirm_dialog;
  var admin_marked_item = {};

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
    $gallery.append($gallery_no_data_text);
  }

  function showGalleryErrorMsg() {
    $gallery_videos.detach();
    $gallery.append($gallery_error_text);
  }

  function createVideo(v) {
    var $item = $("<a class='flex-column'></a>");
    var $vid = $("<video autoplay preload loop muted playsinline disableRemotePlayback></video>");
    $item.append($vid);
    if (typeof user_id === "undefined") {
      if (is_admin) {
        var $control = $("<div class='label-control'></div>");
        var $label_state = $("<p class='text-small-margin'><i></i></p>");
        var $desired_state_select = createLabelStateSelect();
        $desired_state_select.on("change", function () {
          var label_str = $desired_state_select.val();
          admin_marked_item["data"] = [{
            video_id: v["id"],
            label: parseInt(label_str)
          }];
          admin_marked_item["select"] = $desired_state_select;
          admin_marked_item["p"] = $label_state;
          $set_label_confirm_dialog.find("p").text("Set the label of video (id=" + v["id"] + ") to " + label_map[label_str]);
          $set_label_confirm_dialog.dialog("open");
        });
        $control.append($label_state);
        $control.append($desired_state_select);
        $item.append($control);
      }
    } else {
      $item.append($("<i></i>"));
    }
    return $item;
  }

  function createLabelStateSelect() {
    var html = "";
    html += "<select>";
    html += "<option value='default' selected disabled hidden>Set label</option>";
    html += "<option value='11'>" + label_map["11"] + "</option>";
    html += "<option value='10'>" + label_map["10"] + "</option>";
    html += "<option value='1'>" + label_map["1"] + "</option>";
    html += "<option value='0'>" + label_map["0"] + "</option>";
    html += "</select>";
    return $(html);
  }

  function updateItem($item, v) {
    if (typeof user_id === "undefined") {
      if (is_admin) {
        var $i = $item.find("i").removeClass();
        var s = v["label_state"];
        var label = safeGet(label_state_map[s], "Undefined")
        $i.text(v["id"] + ": " + label).addClass("custom-text-info-dark-theme");
        $item.find("select").val("default");
      }
    } else {
      var $i = $item.find("i").removeClass();
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
  }

  function initPagination() {
    if (typeof user_id === "undefined" && is_admin) {
      $(".intro-text").hide();
      $(".admin-text").show();
    }
    $page_nav = $("#page-navigator");
    $page_control = $("#page-control");
    $page_nav.pagination({
      dataSource: api_url_root + api_url_path_get,
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

  function setLabels(labels, callback) {
    $.ajax({
      url: api_url_root + "set_labels",
      type: "POST",
      data: JSON.stringify({
        "data": labels,
        "user_token": user_token
      }),
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

  function initConfirmDialog() {
    $set_label_confirm_dialog = widgets.createCustomDialog({
      selector: "#set-label-confirm-dialog",
      action_text: "Confirm",
      action_callback: function () {
        setLabels(admin_marked_item["data"], {
          "success": function () {
            console.log("Set label successfully:");
            console.log(admin_marked_item["data"]);
            var v_id = admin_marked_item["data"][0]["video_id"];
            var v_label = admin_marked_item["data"][0]["label"];
            var txt = v_id + ": " + safeGet(label_map[v_label], "Undefined");
            admin_marked_item["p"].find("i").text(txt).removeClass().addClass("custom-text-primary-dark-theme");
          },
          "error": function () {
            console.log("Error when setting label:");
            console.log(admin_marked_item["data"]);
            admin_marked_item["p"].find("i").removeClass().addClass("custom-text-danger-dark-theme");
          },
          "complete": function () {
            admin_marked_item["select"].val("default");
            admin_marked_item = {};
          }
        });
      },
      cancel_text: "Cancel",
      cancel_callback: function () {
        admin_marked_item["select"].val("default");
        admin_marked_item = {};
      },
      no_body_scroll: true,
      show_close_button: false
    });
  }

  function init() {
    $gallery = $(".gallery");
    $gallery_videos = $(".gallery-videos");
    user_id = getQueryParas()["user_id"];
    if (typeof user_id !== "undefined") {
      api_url_path_get += "?user_id=" + user_id;
      $(".intro-text").hide();
      $(".user-text").show();
    };
    google_account_dialog = new edaplotjs.GoogleAccountDialog({
      no_ui: true
    });
    initConfirmDialog();
    ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: "UA-10682694-25",
      ready: function (client_id) {
        google_account_dialog.silentSignInWithGoogle(function (is_signed_in, google_user) {
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