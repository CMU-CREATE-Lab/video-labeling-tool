(function () {
  "use strict";

  var util = new edaplotjs.Util();
  var widgets = new edaplotjs.Widgets();
  var google_account_dialog;
  var video_test_dialog;
  var api_url_root = util.getRootApiUrl();
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
  var user_id;
  var is_admin = false;
  var is_researcher = false;
  var user_token;
  var user_token_for_other_app;
  var label_state_map = {
    "47": "Gold Pos",
    "32": "Gold Neg",
    "23": "Strong Pos",
    "16": "Strong Neg",
    "20": "Weak Neg",
    "19": "Weak Pos",
    "15": "Medium Pos",
    "12": "Medium Neg",
    "5": "Maybe Pos",
    "4": "Maybe Neg",
    "3": "Discord",
    "-2": "Bad Data",
    "-1": "No Data"
  };
  var $set_label_confirm_dialog;
  var admin_marked_item = {};
  var is_video_autoplay_tested = false;

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

  // IMPORTANT: Safari on iPhone only allows displaying maximum 16 videos at once
  function createVideo(v) {
    var $item = $("<a class='flex-column'></a>");
    var $vid = $("<video autoplay loop muted playsinline disableRemotePlayback></video>");
    $item.append($vid);
    if (typeof user_id === "undefined") {
      if (is_admin) {
        // Add the display of label states
        var $control = $("<div class='label-control'></div>");
        var $label_state = $("<p class='text-small-margin'><i></i><i></i></p>");
        $control.append($label_state);
        // Add the function for setting label states
        if (is_researcher) {
          var $desired_state_select = createLabelStateSelect();
          $desired_state_select.on("change", function () {
            var label_str = $desired_state_select.val();
            var v_id = $(this).data("v")["id"];
            admin_marked_item["data"] = [{
              video_id: v_id,
              label: parseInt(label_str)
            }];
            admin_marked_item["select"] = $desired_state_select;
            admin_marked_item["p"] = $label_state;
            $set_label_confirm_dialog.find("p").text("Set the label of video (id=" + v_id + ") to " + label_state_map[label_str] + "?");
            $set_label_confirm_dialog.dialog("open");
          });
          $control.append($desired_state_select);
        }
        // Append UI
        $item.append($control);
      }
    } else {
      $item.append($("<i></i>"));
    }
    return $item;
  }

  function createLabelStateSelect() {
    var html = "";
    html += "<select class='custom-select'>";
    html += "<option value='default' selected disabled hidden>Set label</option>";
    html += "<option value='47'>" + label_state_map["47"] + "</option>";
    html += "<option value='32'>" + label_state_map["32"] + "</option>";
    html += "<option value='23'>" + label_state_map["23"] + "</option>";
    html += "<option value='16'>" + label_state_map["16"] + "</option>";
    html += "<option value='-2'>" + label_state_map["-2"] + "</option>";
    html += "<option value='-1'>" + label_state_map["-1"] + "</option>";
    html += "</select>";
    return $(html);
  }

  function updateItem($item, v) {
    if (typeof user_id === "undefined") {
      if (is_admin) {
        var $i = $item.find("i").removeClass();
        var label_admin = util.safeGet(label_state_map[v["label_state_admin"]], "Undefined");
        var label = util.safeGet(label_state_map[v["label_state"]], "Undefined");
        $($i.get(0)).text(v["id"] + ": " + label_admin).addClass("custom-text-info-dark-theme");
        $($i.get(1)).text("Citizen: " + label).addClass("custom-text-info-dark-theme");
        $item.find("select").data("v", v).val("default");
      }
    } else {
      var $i = $item.find("i").removeClass();
      var s = v["label_state"];
      if ([19, 15, 23, 47].indexOf(s) != -1) {
        $i.text("Y").addClass("custom-text-primary-dark-theme");
      } else if ([20, 12, 16, 32].indexOf(s) != -1) {
        $i.text("N").addClass("custom-text-info-dark-theme");
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
      showGoInput: true,
      showGoButton: true,
      showPrevious: false,
      showNext: false,
      callback: function (data, pagination) {
        if (typeof data !== "undefined" && data.length > 0) {
          $(window).scrollTop(0);
          updateVideos(data);
          if (!is_video_autoplay_tested) {
            video_test_dialog.startVideoPlayTest(1000);
            is_video_autoplay_tested = true;
          }
        } else {
          $(window).scrollTop(0);
          showNoGalleryMsg();
        }
        // Handle UI
        var total_page = $page_nav.pagination("getTotalPage");
        if (typeof total_page !== "undefined" && !isNaN(total_page) && total_page != 1) {
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

  function setLabelState(labels, callback) {
    $.ajax({
      url: api_url_root + "set_label_state",
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

  // Read the payload in a JWT
  function getJwtPayload(jwt) {
    return JSON.parse(window.atob(jwt.split('.')[1]));
  }

  function initConfirmDialog() {
    $set_label_confirm_dialog = widgets.createCustomDialog({
      selector: "#set-label-confirm-dialog",
      action_text: "Confirm",
      action_callback: function () {
        setLabelState(admin_marked_item["data"], {
          "success": function () {
            console.log("Set label state successfully:");
            console.log(admin_marked_item["data"]);
            var v_id = admin_marked_item["data"][0]["video_id"];
            var v_label = admin_marked_item["data"][0]["label"];
            var txt = v_id + ": " + util.safeGet(label_state_map[v_label], "Undefined");
            $(admin_marked_item["p"].find("i").get(0)).text(txt).removeClass().addClass("custom-text-primary-dark-theme");
          },
          "error": function () {
            console.log("Error when setting label state:");
            console.log(admin_marked_item["data"]);
            $(admin_marked_item["p"].find("i").get(0)).removeClass().addClass("custom-text-danger-dark-theme");
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

  function initDownloadButton() {
    $("#download-data").on("click", function () {
      var $this = $(this);
      $this.prop("disabled", true);
      $.ajax({
        url: api_url_root + "get_all_labels",
        type: "POST",
        data: {
          user_token: user_token
        },
        contentType: "application/x-www-form-urlencoded; charset=UTF-8",
        dataType: "json",
        success: function (data) {
          // Download data
          util.downloadJSON(data, "video_labels.json");
          // Reset button
          $this.prop("disabled", false);
        },
        error: function (xhr) {
          console.error("Error when getting video json!", xhr);
        }
      });
    });
    $("#download-user-token").on("click", function () {
      var $this = $(this);
      $this.prop("disabled", true);
      // Download data
      util.downloadJSON({
        user_token: user_token_for_other_app
      }, "user_token.json");
      // Reset button
      $this.prop("disabled", false);
    });
  }

  function onLoginSuccess(data) {
    user_token = data["user_token"];
    user_token_for_other_app = data["user_token_for_other_app"];
    var payload = getJwtPayload(user_token);
    var client_type = payload["client_type"];
    var desired_href_review = "gallery.html" + "?user_id=" + payload["user_id"];
    $("#review-community").prop("href", desired_href_review);
    $("#review-admin").prop("href", desired_href_review);
    is_admin = (client_type == 0 || client_type == 1) ? true : false;
    is_researcher = client_type == 0 ? true : false;
    if (is_admin) {
      $(".admin-text").show();
      $(".admin-control").css("display", "flex");
    } else {
      $(".community-control").css("display", "flex");
    }
  }

  function onLoginComplete() {
    initPagination();
  }

  function setVideoTypeText(method) {
    var $s = $("#video-type-text");
    if (method == "get_pos_labels") {
      $s.text("community-labeled videos with smoke by multiple users");
    } else if (method == "get_neg_labels") {
      $s.text("community-labeled videos with no smoke");
    } else if (method == "get_pos_labels_by_researcher") {
      $s.text("researcher-labeled videos with smoke");
    } else if (method == "get_neg_labels_by_researcher") {
      $s.text("researcher-labeled videos with no smoke");
    } else if (api_url_path_get == "get_pos_gold_labels") {
      $s.text("researcher-labeled gold standards with smoke");
    } else if (api_url_path_get == "get_neg_gold_labels") {
      $s.text("researcher-labeled gold standards with no smoke");
    } else if (api_url_path_get == "get_partial_labels") {
      $s.text("partially labeled videos");
    } else if (api_url_path_get == "get_bad_labels") {
      $s.text("videos with bad labels");
    } else if (api_url_path_get == "get_maybe_pos_labels") {
      $s.text("community-labeled videos that maybe have smoke");
    }
  }

  function init() {
    $gallery = $(".gallery");
    $gallery_videos = $(".gallery-videos");
    var query_paras = getQueryParas();
    user_id = query_paras["user_id"];
    var method = query_paras["method"];
    if (typeof method !== "undefined") {
      api_url_path_get = method;
    }
    setVideoTypeText(method);
    if (typeof user_id !== "undefined") {
      api_url_path_get += "?user_id=" + user_id;
      $(".user-text").show();
    } else {
      $(".intro-text").show();
    }
    initDownloadButton();
    google_account_dialog = new edaplotjs.GoogleAccountDialog({
      no_ui: true
    });
    initConfirmDialog();
    var ga_tracker = new edaplotjs.GoogleAnalyticsTracker({
      tracker_id: util.getGoogleAnalyticsId(),
      ready: function (client_id) {
        google_account_dialog.silentSignInWithGoogle(function (is_signed_in, google_user) {
          if (is_signed_in) {
            util.login({
              google_id_token: google_user.getAuthResponse().id_token
            }, {
              success: onLoginSuccess,
              complete: onLoginComplete
            });
          } else {
            util.login({
              client_id: client_id
            }, {
              success: onLoginSuccess,
              complete: onLoginComplete
            });
          }
        });
      }
    });
    video_test_dialog = new edaplotjs.VideoTestDialog();
  }

  $(init);
})();