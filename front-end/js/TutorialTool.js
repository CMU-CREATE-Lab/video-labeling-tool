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
    var current_idx = 0;
    var is_in_checking_state = false;
    var video_items = [];
    var wrong_times = 0;
    var $next;
    var num_tries_to_pass = 1; // number of tries to pass the last batch of the tutorial
    //var smoke_polygon = ""; // for drawing polygons to indicate smoke (debug)

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $next = $("#next");
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
      var $caption = $("<div class='number'>" + (i + 1) + "</div>");
      var $hint = $("<p class='hint'></p>").hide();
      var $description = $("<p class='description'></p>").hide();
      // "autoplay" is needed for iPhone Safari to work
      // "preload" is ignored by mobile devices
      // "disableRemotePlayback" prevents chrome casting
      // "playsinline" prevents playing video fullscreen
      var $vid = $('<div class="mask"><video autoplay preload loop muted playsinline disableRemotePlayback></video></div>');
      $item.append($vid).append($caption).append($hint).append($description);
      /********* start debug *********/
      /*smoke_polygon = "";
      $vid.on("click", function (event) {
        var $v = $vid.find("video");
        var vw = $v.width();
        var vh = $v.height();
        var margin_x = ($vid.width() - vw) / 2;
        var margin_y = ($vid.height() - vh) / 2;
        var x = event.offsetX + margin_x - 3;
        var y = event.offsetY + margin_y - 3;
        $vid.append($("<div class='smoke-polygon' style='width: 6px; height: 6px; background: red; position: absolute; left:" + x + "px; top:" + y + "px;'></div>"))
        smoke_polygon += Math.round(x / vw * 100) + "," + Math.round(y / vh * 100) + " ";
        console.log(smoke_polygon);
      });*/
      /********* end debug *********/
      return $item;
    }

    function updateHint(video_data) {
      for (var i = 0; i < video_items.length; i++) {
        var v = video_data[i];
        var $item = video_items[i];
        $item.find("p.hint").html(v["hint"]).show();
      }
    }

    function updateDescription(video_data) {
      var is_all_answers_correct = true;
      for (var i = 0; i < video_items.length; i++) {
        var v = video_data[i];
        var $item = video_items[i];
        $item.off("click");
        $item.css("cursor", "default");
        var c = "";
        var m = v["correct"];
        var label = $item.hasClass("selected") ? 1 : 0;
        if (label !== v["label"]) {
          m = v["wrong"];
          is_all_answers_correct = false;
          addHighlight($item, false);
        } else {
          addHighlight($item, true);
        }
        $item.find("p.hint").html("").hide();
        $item.find("p.description").html(m).show();
        if ("bound" in v) {
          var svg = "";
          svg += '<svg viewBox="0 0 100 100">';
          svg += '  <defs>';
          svg += '    <mask id="mask-' + i + '" x="0" y="0" width="100%" height="100%">';
          svg += '      <rect x="0" y="0" width="100%" height="100%" fill="white"/>';
          svg += '      <polygon class="mask-polygon" points="' + v["bound"] + '"/>';
          svg += '    </mask>';
          svg += '  </defs>';
          svg += '  <rect x="0" y="0" width="100%" height="100%" style="mask: url(#mask-' + i + ');" />';
          svg += '</svg>';
          $item.find(".mask").append($(svg));
        }
      }
      return is_all_answers_correct;
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
        $item.on("click", function () {
          toggleSelect($(this));
        });
        $item.css("cursor", "pointer");
        $item.find("svg").remove();
        $item.find("p").html("").hide();
        //$item.find(".smoke-polygon").remove(); // for drawing polygons to indicate smoke (debug)
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
        var src_url = v["url"];
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
      if ($element.hasClass("highlight-white")) {
        $element.removeClass("highlight-white");
      }
      if ($element.hasClass("highlight-info")) {
        $element.removeClass("highlight-info");
      }
    }

    function addHighlight($element, is_answer_correct) {
      if (is_answer_correct && !$element.hasClass("highlight-white")) {
        $element.addClass("highlight-white");
      }
      if (!is_answer_correct && !$element.hasClass("highlight-info")) {
        $element.addClass("highlight-info");
      }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.next = function (callback) {
      callback = safeGet(callback, {});
      if (util.browserSupported()) {
        if (current_idx == data.length && !is_in_checking_state) {
          $(window).off("beforeunload", leaveCheck);
          $tool_instruction.hide();
          if (typeof on_tutorial_finished === "function") on_tutorial_finished(num_tries_to_pass);
        } else {
          if (is_in_checking_state) {
            var d = data[current_idx];
            var is_all_answers_correct = updateDescription(d["data"]);
            if (is_all_answers_correct) {
              $tool_instruction.html(d["correct"]);
            } else {
              wrong_times += 1;
              $tool_instruction.html(d["wrong"]);
              if (current_idx == data.length - 1) {
                num_tries_to_pass += 1;
              }
            }
            if (typeof callback["success"] === "function") callback["success"](data);
            if (!is_all_answers_correct && wrong_times == 1 && "try_again" in d) {
              $next.find("span").text("Try Again");
            } else if (!is_all_answers_correct && wrong_times == 2 && "final_try" in d) {
              $next.find("span").text("Try Again (with hints)");
            } else {
              current_idx += 1;
              wrong_times = 0;
              $next.find("span").text("Next Step");
            }
            is_in_checking_state = false;
          } else {
            var d = data[current_idx];
            var video_data = util.shuffleArrayInPlace(d["data"]);
            updateVideos(video_data, callback);
            $next.find("span").text("Check Answer");
            if (wrong_times == 1 && "try_again" in d) {
              $tool_instruction.html(d["try_again"]);
            } else if (wrong_times == 2 && "final_try" in d) {
              $tool_instruction.html(d["final_try"]);
              updateHint(video_data);
            } else {
              $tool_instruction.html(d["instruction"]);
            }
            is_in_checking_state = true;
          }
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