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
    var client_id;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //
    function init() {
      if (typeof tracker_id !== "undefined") {
        ga("create", tracker_id, "auto");
        ga(function (tracker) {
          client_id = "ga." + tracker.get("clientId"); // prepend "ga" to indicate Google Analytics
          ga("send", "pageview");
          if (typeof ready === "function") ready(client_id);
        });
      } else {
        ready(client_id);
      }
    }

    function safeGet(v, default_val) {
      return util.safeGet(v, default_val);
    }

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