(function () {
  "use strict";
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var TutorialPromptDialog = function (settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    var util = new edaplotjs.Util();
    settings = safeGet(settings, {});
    var $tutorial_prompt_dialog;
    var widgets = new edaplotjs.Widgets();
    var video_labeling_tool = settings["video_labeling_tool"];
    var api_url_root = util.getRootApiUrl();

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //

    function init() {
      // The dialog for users to manually enable video autoplay
      $tutorial_prompt_dialog = widgets.createCustomDialog({
        selector: "#tutorial-prompt-dialog",
        show_cancel_btn: false,
        width: 270
      });
      $("#take-tutorial-button").on("click", function () {
        // Add tutorial record based on action types
        util.postJSON(api_url_root + "add_tutorial_record", {
          "user_token": video_labeling_tool.userToken(),
          "action_type": 0, // this means that users take the tutorial
          "query_type": 2 // this means that users click the tutorial button from the prompt dialog (not the webpage)
        }, {
          success: function () {
            $("#take-tutorial-button").prop("disabled", true);
            $(location).attr("href", "tutorial.html");
          },
          error: function (xhr) {
            console.error("Error when adding tutorial record!");
          }
        });
      });
    }

    this.getDialog = function () {
      return $tutorial_prompt_dialog;
    };

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //

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
    window.edaplotjs.TutorialPromptDialog = TutorialPromptDialog;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.TutorialPromptDialog = TutorialPromptDialog;
  }
})();