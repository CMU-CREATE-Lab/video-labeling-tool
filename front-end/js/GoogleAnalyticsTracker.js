// Adding analytics.js
(function (i, s, o, g, r, a, m) {
  i['GoogleAnalyticsObject'] = r;
  i[r] = i[r] || function () {
    (i[r].q = i[r].q || []).push(arguments)
  }, i[r].l = 1 * new Date();
  a = s.createElement(o),
    m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m)
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

(function () {
  "use strict";
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var GoogleAnalyticsTracker = function (settings) {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    var util = new edaplotjs.Util();
    settings = safeGet(settings, {});
    var tracker_id = settings["tracker_id"];
    var ready = settings["ready"];
    var client_id = util.getUniqueId();
    var is_ga_ready_event_called = false;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      setTimeout(function () {
        if (typeof window.ga !== "undefined" && typeof ga.create !== "undefined" && typeof tracker_id !== "undefined") {
          ga("create", tracker_id, "auto");
          ga(function (tracker) {
            client_id = "ga." + tracker.get("clientId"); // prepend "ga" to indicate Google Analytics
            ga("send", "pageview");
            if (typeof ready === "function") ready(client_id);
            is_ga_ready_event_called = true
          });
          setTimeout(function () {
            if (!is_ga_ready_event_called) {
              // This means that maybe some third party plugin blocks the ga tracker (e.g., duckduckgo)
              console.warn("The Google Analytics tracker may be blocked. Use the system generated uuid for the client id instead.")
              if (typeof ready === "function") ready(client_id);
            }
          }, 5000);
        } else {
          // When tracking protection is on or no tracker id, use the generated uuid for the client_id
          console.warn("The Google Analytics tracker may be blocked. Use the system generated uuid for the client id instead.")
          if (typeof ready === "function") ready(client_id);
        }
      }, 500); // give some time in case the browser still did not finish loading the ga tracker
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //
    this.getClientId = function () {
      return client_id;
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
    window.edaplotjs.GoogleAnalyticsTracker = GoogleAnalyticsTracker;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.GoogleAnalyticsTracker = GoogleAnalyticsTracker;
  }
})();
