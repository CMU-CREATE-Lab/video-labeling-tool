(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var VideoLabelingTool = function (container_selector, settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    var util = new edaplotjs.Util();
    settings = safeGet(settings, {});
    var $container = $(container_selector);
    var $tool;
    var $tool_videos;
    var video_items = [];
    var $bad_video_text = $('<span class="bad-video-text">Oops!<br>Some video links are broken.<br>Please refresh this page.</span>');
    var $error_text = $('<span class="error-text">Oops!<br>Server may be down or busy.<br>Please come back later.</span>');
    var $no_data_text = $('<span class="no-data-text">Thank you!<br>Videos are all labeled.<br>Please come back later.</span>');
    var $loading_text = $('<span class="loading-text"></span>');
    var $not_supported_text = $('<span class="not-supported-text">We are sorry!<br>Your browser is not supported.</span>');
    var api_url_root = util.getRootApiUrl();
    var user_id;
    var video_token;
    var user_token;
    var this_obj = this;
    var user_score;
    var user_raw_score;
    var on_user_score_update = settings["on_user_score_update"];
    var is_admin;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $tool = $('<div class="video-labeling-tool"></div>');
      $tool_videos = $('<div class="video-labeling-tool-videos"></div>');
      $container.append($tool.append($tool_videos));
      showLoadingMsg();
    }

    // Get the user id from the server
    function login(post_json, callback) {
      callback = safeGet(callback, {});
      util.postJSON(api_url_root + "login", post_json, {
        success: function (data) {
          if (typeof callback["success"] === "function") callback["success"](data);
        },
        error: function (xhr) {
          console.error("Error when getting user id!");
          printServerErrorMsg(xhr);
          showErrorMsg();
          if (typeof callback["error"] === "function") callback["error"](xhr);
        }
      });
    }

    // Get the json file that contains image links
    function getVideoBatch(callback) {
      callback = safeGet(callback, {});
      util.postJSON(api_url_root + "get_batch", {
        user_token: user_token,
      }, {
        success: function (data) {
          if (typeof callback["success"] === "function") callback["success"](data);
        },
        error: function (xhr) {
          console.error("Error when getting video urls!");
          printServerErrorMsg(xhr);
          showErrorMsg();
          if (xhr.status == 401) {
            // This means that the user token is not valid
            if (typeof callback["error"] === "function") callback["error"](xhr);
          } else {
            if (typeof callback["error"] === "function") callback["error"](xhr);
          }
        }
      });
    }

    // Print error message returned by the server
    function printServerErrorMsg(xhr) {
      console.error("Server respond: " + JSON.stringify(xhr.responseJSON));
    }

    // Print warning message returned by the server
    function printServerWarnMsg(xhr) {
      console.warn("Server respond: " + JSON.stringify(xhr.responseJSON));
    }

    // Set a batch of labeled video clips back to the server
    function sendVideoBatch(callback, options) {
      callback = safeGet(callback, {});
      options = safeGet(options, {});
      var ignore_labels = safeGet(options["ignore_labels"], false);
      var labels = collectAndRemoveLabels();
      showLoadingMsg();
      if (labels.length == 0 || ignore_labels) {
        if (typeof callback["success"] === "function") callback["success"]();
      } else {
        util.postJSON(api_url_root + "send_batch", {
          video_token: video_token,
          user_token: user_token,
          data: labels
        }, {
          success: function (data) {
            if (typeof callback["success"] === "function") callback["success"](data);
          },
          error: function (xhr) {
            console.error("Error when sending video labels to the server!");
            printServerErrorMsg(xhr);
            showErrorMsg();
            if (xhr.status == 401) {
              // This means that the video token or user token is not valid
              if (typeof callback["error"] === "function") callback["error"](xhr);
            } else {
              if (typeof callback["error"] === "function") callback["error"](xhr);
            }
          }
        });
      }
    }

    // Collect labels from the user interface
    function collectAndRemoveLabels() {
      var labels = [];
      $tool_videos.find("a").each(function () {
        var $item = $(this);
        var video_id = $item.data("id");
        if (typeof video_id === "undefined") return;
        var is_selected = $item.hasClass("selected") ? 1 : 0;
        labels.push({
          video_id: video_id,
          label: is_selected
        });
        $item.removeData("id")
      });
      return labels;
    }

    // Create a video label element
    // IMPORTANT: Safari on iPhone only allows displaying maximum 16 videos at once
    // UPDATE: starting from Safari 12, more videos are allowed
    function createVideo(i) {
      var $item = $("<a href='javascript:void(0)' class='flex-column'></a>");
      var $caption = $("<div>" + (i + 1) + "</div>");
      // "autoplay" is needed for iPhone Safari to work
      // "preload" is ignored by mobile devices
      // "disableRemotePlayback" prevents chrome casting
      // "playsinline" and "playsInline" prevents playing video fullscreen
      var $vid = $("<video autoplay preload loop muted playsinline playsInline disableRemotePlayback></video>");
      $item.on("click", function () {
        toggleSelect($(this));
      });
      $item.append($vid).append($caption);
      return $item;
    }

    // Update the videos with a new batch of urls
    function updateVideos(video_data, callback) {
      var deferreds = [];
      // Add videos
      for (var i = 0; i < video_data.length; i++) {
        var v = video_data[i];
        var $item;
        if (typeof video_items[i] === "undefined") {
          $item = createVideo(i);
          video_items.push($item);
          $tool_videos.append($item);
        } else {
          $item = video_items[i];
          removeSelect($item);
        }
        $item.data("id", v["id"]);
        var $vid = $item.find("video");
        $vid.one("canplay", function () {
          // Play the video
          util.handleVideoPromise(this, "play");
        });
        if (!$vid.complete) {
          var deferred = $.Deferred();
          $vid.one("canplay", deferred.resolve);
          $vid.one("error", deferred.reject);
          deferreds.push(deferred);
        }
        var src_url = v["url_root"] + v["url_part"];
        src_url = util.replaceThumbnailWidth(src_url); // always use high resolution videos
        $vid.prop("src", src_url);
        util.handleVideoPromise($vid.get(0), "load"); // load to reset video promise
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
      // Load and show videos
      callback = safeGet(callback, {});
      util.resolvePromises(deferreds, {
        success: function (data) {
          updateTool($tool_videos);
          if (typeof callback["success"] === "function") callback["success"](data);
        },
        error: function (xhr) {
          console.warn("Some video urls are broken.");
          printServerWarnMsg(xhr);
          showBadVideoMsg();
          if (typeof callback["abort"] === "function") callback["abort"](xhr);
        }
      });
    }

    // Toggle the "select" class of a DOM element
    function toggleSelect($element) {
      if ($element.hasClass("selected")) {
        $element.removeClass("selected");
      } else {
        $element.addClass("selected");
      }
    }

    // Remove the "select" class of a DOM element
    function removeSelect($element) {
      if ($element.hasClass("selected")) {
        $element.removeClass("selected");
      }
    }

    function updateTool($new_content) {
      $tool_videos.detach(); // detatch prevents the click event from being removed
      $tool.empty().append($new_content);
    }

    // Show not supported message
    function showNotSupportedMsg() {
      updateTool($not_supported_text);
    }

    // Show error message
    function showErrorMsg() {
      updateTool($error_text);
    }

    // Show no data message
    function showNoDataMsg() {
      updateTool($no_data_text);
    }

    // Show bad video requests message
    function showBadVideoMsg() {
      updateTool($bad_video_text);
    }

    // Show loading message
    function showLoadingMsg() {
      updateTool($loading_text);
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    // Read the payload in a JWT
    function getJwtPayload(jwt) {
      return JSON.parse(window.atob(jwt.split('.')[1]));
    }

    // When getting a batch of videos successfully, update videos
    function onGetVideoBatchSuccess(data, callback) {
      if (typeof data === "undefined") {
        console.error("The server does not return any data.");
        showNoDataMsg();
        if (typeof callback["error"] === "function") callback["error"]();
      } else {
        updateVideos(data["data"], {
          success: function () {
            // Need to store the token and return it back to the server when finished
            video_token = data["video_token"];
            if (typeof callback["success"] === "function") callback["success"]();
          },
          error: function (xhr) {
            if (typeof callback["error"] === "function") callback["error"](xhr);
          },
          abort: function (xhr) {
            // Need to store the token and return it back to the server when finished
            video_token = data["video_token"];
            if (typeof callback["abort"] === "function") callback["abort"](xhr);
          }
        });
      }
    }

    // When sending the current batch of video labels successfully, get a new batch of videos
    function onSendVideoBatchSuccess(data, callback) {
      // Update the user score
      if (typeof data !== "undefined") {
        user_score = data["data"]["score"]["user"];
        user_raw_score = data["data"]["score"]["raw"];
        if (typeof on_user_score_update === "function") on_user_score_update(user_score, user_raw_score, data["data"]["score"]["batch"]);
      }
      // Get a new batch
      getVideoBatch({
        success: function (data) {
          onGetVideoBatchSuccess(data, callback);
        },
        error: function (xhr) {
          if (typeof callback["error"] === "function") callback["error"](xhr);
        },
        abort: function (xhr) {
          if (typeof callback["abort"] === "function") callback["abort"](xhr);
        }
      });
    }

    // When the user ID is updated successfully
    function onUserIdUpdateSuccess(data) {
      user_token = data["user_token"];
      var user_payload = getJwtPayload(user_token);
      user_id = user_payload["user_id"];
      user_score = user_payload["user_score"];
      user_raw_score = user_payload["user_raw_score"];
      is_admin = user_payload["client_type"] == 0 ? true : false;
      if (typeof on_user_score_update === "function") on_user_score_update(user_score, user_raw_score);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.next = function (callback, options) {
      callback = safeGet(callback, {});
      if (util.browserSupported()) {
        sendVideoBatch({
          success: function (data) {
            onSendVideoBatchSuccess(data, callback);
          },
          error: function (xhr) {
            if (typeof callback["error"] === "function") callback["error"](xhr);
          },
          abort: function (xhr) {
            onSendVideoBatchSuccess(xhr.responseJSON, callback);
          }
        }, options);
      } else {
        showNotSupportedMsg();
        console.warn("Browser not supported.")
        if (typeof callback["error"] === "function") callback["error"]("Browser not supported.");
      }
    };

    this.userId = function () {
      return user_id;
    };

    this.updateUserIdByGoogleIdToken = function (google_id_token, callback) {
      callback = safeGet(callback, {});
      login({
        google_id_token: google_id_token
      }, {
        success: function (data) {
          onUserIdUpdateSuccess(data);
          if (typeof callback["success"] === "function") callback["success"](this_obj);
        },
        error: function (xhr) {
          if (typeof callback["error"] === "function") callback["error"](xhr);
        }
      });
    };

    this.updateUserIdByClientId = function (new_client_id, callback) {
      callback = safeGet(callback, {});
      login({
        client_id: safeGet(new_client_id, util.getUniqueId())
      }, {
        success: function (data) {
          onUserIdUpdateSuccess(data);
          if (typeof callback["success"] === "function") callback["success"](this_obj);
        },
        error: function (xhr) {
          if (typeof callback["error"] === "function") callback["error"](xhr);
        }
      });
    };

    this.userScore = function () {
      return user_score;
    };

    this.isAdmin = function () {
      return is_admin;
    };

    this.userToken = function () {
      return user_token;
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
    window.edaplotjs.VideoLabelingTool = VideoLabelingTool;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.VideoLabelingTool = VideoLabelingTool;
  }
})();