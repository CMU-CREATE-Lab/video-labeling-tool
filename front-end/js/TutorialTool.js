(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var TutorialTool = function (container_selector, settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    var util = new edaplotjs.Util();
    settings = safeGet(settings, {});
    var $container = $(container_selector);
    var $tool;
    var $tool_videos;
    var $tool_instruction;
    var $loading_text = $('<span class="loading-text"></span>');
    var $not_supported_text = $('<span class="not-supported-text">We are sorry!<br>Your browser is not supported.</span>');
    var on_tutorial_finished = settings["on_tutorial_finished"];
    var data = settings["data"];
    var current_idx = -1;
    var video_items = [];

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $tool_instruction = $("#tutorial-tool-instruction");
      $tool = $('<div class="tutorial-tool"></div>');
      $tool_videos = $('<div class="tutorial-tool-videos"></div>');
      $container.append($tool.append($tool_videos));
      showLoadingMsg();
      $(window).on("beforeunload", leaveCheck);
    }

    function leaveCheck() {
      // Some browsers ignore this message and just give a confirmation window.
      return "Are you sure you want to leave this tutorial?";
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    function updateTool($new_content) {
      $tool_videos.detach(); // detatch prevents the click event from being removed
      $tool.empty().append($new_content);
    }

    function showLoadingMsg() {
      updateTool($loading_text);
    }

    function showNotSupportedMsg() {
      updateTool($not_supported_text);
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
      // "playsinline" prevents playing video fullscreen
      var $vid = $("<video autoplay preload loop muted playsinline disableRemotePlayback></video>");
      $item.on("click", function () {
        toggleSelect($(this));
      });
      $item.append($vid).append($caption);
      return $item;
    }

    function updateVideos(video_data, callback) {
      showLoadingMsg();
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
        $vid.prop("src", v["url"]);
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

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.next = function (callback) {
      callback = safeGet(callback, {});
      if (util.browserSupported()) {
        if (current_idx == data.length - 1) {
          $(window).off("beforeunload", leaveCheck);
          $tool_instruction.hide();
          if (typeof on_tutorial_finished === "function") on_tutorial_finished();
        } else {
          current_idx += 1;
          var d = data[current_idx];
          updateVideos(util.shuffleArray(d["data"]), callback);
          $tool_instruction.text(d["instruction"]);
        }
      } else {
        showNotSupportedMsg();
        console.warn("Browser not supported.");
        if (typeof callback["error"] === "function") callback["error"]("Browser not supported.");
      }
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
    window.edaplotjs.TutorialTool = TutorialTool;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.TutorialTool = TutorialTool;
  }
})();