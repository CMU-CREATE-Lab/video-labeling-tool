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

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      $tool = $('<div class="tutorial-tool"></div>');
      $tool_videos = $('<div class="tutorial-tool-videos"></div>');
      $container.append($tool.append($tool_videos));
      showLoadingMsg();
      console.log(data);
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

    function updateTutorial(idx) {
      $tool.empty().append($tool_videos);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.next = function (callback) {
      callback = safeGet(callback, {});
      if (util.browserSupported()) {
        updateTutorial();
        if (typeof callback["success"] === "function") callback["success"]();
      } else {
        showNotSupportedMsg();
        console.warn("Browser not supported.")
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