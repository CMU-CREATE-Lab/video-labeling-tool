/*
 * TODO: remove google-signin-client_id meta name from the index.html
 * TODO: add a playback timeline bar to show the video playback time
 * TODO: if the labels are rejected (due to poor quality), need to let user know
 * TODO: show a bar (with badge) about how many videos are correctly labeled
 * - use gold standard videos to verify this (each batch has at least one)
 * TODO: allow users to share the badge with the achievement on social media
 * TODO: as users gain enough scores, advance them to the harder mode
 * - laypeople mode: select videos that have smoke
 * - amateur mode: draw bounding boxes (BBOX) for smoke for each video
 * - expert mode: draw BBOX and provide smoke info (e.g., blue, black)
 * TODO: ask the user to enter a nick name at the begining for the ladder board
 * TODO: add an ladder board for showing nick names and scores
 */

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
    settings = safeGet(settings, {});
    var $container = $(container_selector);
    var $tool;
    var $tool_videos;
    var video_items = [];
    var $bad_video_text = $('<span class="bad-video-text">Oops!<br>Some video links are broken.<br>Please press "Keep Going" to skip this video batch.</span>');
    var $error_text = $('<span class="error-text">Oops!<br>Server may be down or busy.<br>Please come back later.</span>');
    var $no_data_text = $('<span class="no-data-text">Thank you!<br>Available videos are all labeled.<br>Please come back tomorrow.</span>');
    var $loading_text = $('<span class="loading-text"></span>');
    var api_url_root = getRootApiUrl();
    var client_id = safeGet(settings["client_id"], getUniqueId());
    var user_id;
    var video_token;
    var user_token;
    var this_obj = this;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $tool = $('<div class="video-labeling-tool"></div>');
      $tool_videos = $('<div class="video-labeling-tool-videos"></div>');
      $container.append($tool.append($tool_videos));
    }

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

    // Get the user id from the server
    function login(post_json, callback) {
      callback = safeGet(callback, {});
      postJSON(api_url_root + "login", JSON.stringify(post_json), {
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
      postJSON(api_url_root + "get_batch", JSON.stringify({
        user_token: user_token,
      }), {
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
    function sendVideoBatch(callback) {
      callback = safeGet(callback, {});
      var labels = collectAndRemoveLabels();
      showLoadingMsg();
      if (labels.length == 0) {
        if (typeof callback["success"] === "function") callback["success"]();
      } else {
        postJSON(api_url_root + "send_batch", JSON.stringify({
          video_token: video_token,
          user_token: user_token,
          data: labels
        }), {
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
    function createVideo(i) {
      var $item = $("<a href='javascript:void(0)' class='flex-column'></a>");
      var $caption = $("<div>" + (i + 1) + "</div>");
      var $vid = $("<video autoplay preload loop muted playsinline></video>");
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
          this.play();
        });
        if (!$vid.complete) {
          var deferred = $.Deferred();
          $vid.one("canplay", deferred.resolve);
          $vid.one("error", deferred.reject);
          deferreds.push(deferred);
        }
        $vid.prop("src", v["url_root"] + v["url_part"]);
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
      // Autoplay videos
      resolvePromises(deferreds, {
        success: function (data) {
          $tool.empty().append($tool_videos);
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

    // Show error message
    function showErrorMsg() {
      $tool_videos.detach();
      $tool.empty().append($error_text);
    }

    // Show no data message
    function showNoDataMsg() {
      $tool_videos.detach();
      $tool.empty().append($no_data_text);
    }

    // Show bad video requests message
    function showBadVideoMsg() {
      $tool_videos.detach();
      $tool.empty().append($bad_video_text);
    }

    // Show loading message
    function showLoadingMsg() {
      $tool_videos.detach();
      $tool.empty().append($loading_text);
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

    // Post JSON
    function postJSON(url, data, callback) {
      callback = safeGet(callback, {});
      $.ajax({
        url: url,
        type: "POST",
        data: data,
        contentType: "application/json",
        dataType: "json",
        success: function (data) {
          if (typeof callback["success"] === "function") callback["success"](data);
        },
        error: function (xhr) {
          if (typeof callback["error"] === "function") callback["error"](xhr);
        }
      });
    }

    // Generate a unique id
    function getUniqueId() {
      // The prefix "uuid" is used for identifying that the client id is generated from this function
      return "uuid." + new Date().getTime() + "." + Math.random().toString(36).substring(2);
    }

    // Resolve promises and call back
    function resolvePromises(promises, callback) {
      callback = safeGet(callback, {});
      $.when.apply($, promises).done(function () {
        if (typeof callback["success"] === "function") callback["success"]();
      }).fail(function (xhr) {
        if (typeof callback["error"] === "function") callback["error"](xhr);
      })
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
            // need to store the token and return it back to the server when finished
            video_token = data["video_token"];
            if (typeof callback["success"] === "function") callback["success"]();
          },
          error: function (xhr) {
            if (typeof callback["error"] === "function") callback["error"](xhr);
          },
          abort: function (xhr) {
            if (typeof callback["abort"] === "function") callback["abort"](xhr);
          }
        });
      }
    }

    // When sending the current batch of video labels successfully, get a new batch of videos
    function onSendVideoBatchSuccess(data, callback) {
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

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.next = function (callback) {
      callback = safeGet(callback, {});
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
      });
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
          user_token = data["user_token"];
          user_id = getJwtPayload(user_token)["user_id"];
          if (typeof callback["success"] === "function") callback["success"](this_obj);
        },
        error: function (xhr) {
          if (typeof callback["error"] === "function") callback["error"](xhr);
        }
      });
    };

    this.updateUserIdByClientId = function (new_client_id, callback) {
      callback = safeGet(callback, {});
      client_id = safeGet(new_client_id, client_id);
      login({
        client_id: client_id
      }, {
        success: function (data) {
          user_token = data["user_token"];
          user_id = getJwtPayload(user_token)["user_id"];
          if (typeof callback["success"] === "function") callback["success"](this_obj);
        },
        error: function (xhr) {
          if (typeof callback["error"] === "function") callback["error"](xhr);
        }
      });
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