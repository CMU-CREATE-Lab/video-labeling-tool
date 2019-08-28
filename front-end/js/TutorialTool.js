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
    var $loading_text = $('<span class="loading-text"></span>');
    var $not_supported_text = $('<span class="not-supported-text">We are sorry!<br>Your browser is not supported.</span>');
    var on_tutorial_finished = settings["on_tutorial_finished"];
    var data = settings["data"];
    var current_idx = -1;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
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

    function showLoadingMsg() {
      $tool_videos.detach();
      $tool.empty().append($loading_text);
    }

    function showNotSupportedMsg() {
      $tool_videos.detach();
      $tool.empty().append($not_supported_text);
    }

    function updateTutorial(batch_data, callback) {
      $tool.empty().append($tool_videos);
      console.log(batch_data);
      if (typeof callback["success"] === "function") callback["success"]();
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.next = function (callback) {
      callback = safeGet(callback, {});
      if (util.browserSupported()) {
        if (current_idx < data.length - 1) {
          current_idx += 1;
          updateTutorial(data[current_idx], callback);
          if (current_idx == data.length - 1) {
            $(window).off("beforeunload", leaveCheck);
            if (typeof on_tutorial_finished === "function") on_tutorial_finished();
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