(function () {
  "use strict";

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Create the class
  //
  var Util = function () {
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Privileged methods
    //

    // Safely get the value from a variable, return a default value if undefined
    var safeGet = function (v, default_val) {
      if (typeof default_val === "undefined") default_val = "";
      return (typeof v === "undefined") ? default_val : v;
    };
    this.safeGet = safeGet;

    // Get the the root url of the API
    var getRootApiUrl = function () {
      var root_url;
      var url_hostname = window.location.hostname;
      var is_localhost = url_hostname.indexOf("localhost");
      var is_staging = url_hostname.indexOf("staging");
      var is_testing = url_hostname.indexOf("192.168");
      if (is_localhost >= 0 || is_testing >= 0) {
        root_url = "http://" + url_hostname + ":5000/api/v1/";
      } else {
        if (is_staging >= 0) {
          root_url = "https://staging.api.smoke.createlab.org/api/v1/";
        } else {
          root_url = "https://api.smoke.createlab.org/api/v1/";
        }
      }
      return root_url;
    };
    this.getRootApiUrl = getRootApiUrl;

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Public methods
    //

    // Get the the Google Analytics id
    this.getGoogleAnalyticsId = function () {
      var ga_id;
      var url_hostname = window.location.hostname;
      var is_localhost = url_hostname.indexOf("localhost");
      var is_staging = url_hostname.indexOf("staging");
      if (is_localhost >= 0) {
        ga_id = "UA-10682694-25";
      } else {
        if (is_staging >= 0) {
          ga_id = "UA-10682694-25";
        } else {
          ga_id = "UA-10682694-26";
        }
      }
      return ga_id;
    };

    // Post JSON
    this.postJSON = function (url, data, callback) {
      callback = safeGet(callback, {});
      $.ajax({
        url: url,
        type: "POST",
        data: JSON.stringify(data),
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
    };

    // Generate a unique id
    this.getUniqueId = function () {
      // The prefix "uuid" is used for identifying that the client id is generated from this function
      return "uuid." + new Date().getTime() + "." + Math.random().toString(36).substring(2);
    };

    // Download json data as a file
    this.downloadJSON = function (data, file_name) {
      var blob = new Blob([JSON.stringify(data)], {
        type: "application/json"
      });
      var link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    // Read the payload in a JWT
    this.getJwtPayload = function (jwt) {
      return JSON.parse(window.atob(jwt.split('.')[1]));
    };

    // Login to the smoke labeling tool
    this.login = function (post_json, callback) {
      callback = safeGet(callback, {});
      $.ajax({
        url: getRootApiUrl() + "login",
        type: "POST",
        data: JSON.stringify(post_json),
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
    };

    // Check if a string contains a substring
    this.hasSubString = function (str, sub_str) {
      return str.indexOf(sub_str) !== -1;
    };

    // Parse variables in the format of a hash url string
    this.parseVars = function (str, keep_null_or_undefined_vars) {
      var vars = {};
      if (str) {
        var keyvals = str.split(/[#?&]/);
        for (var i = 0; i < keyvals.length; i++) {
          var keyval = keyvals[i].split('=');
          vars[keyval[0]] = keyval[1];
        }
      }
      // Delete keys with null/undefined values
      if (!keep_null_or_undefined_vars) {
        Object.keys(vars).forEach(function (key) {
          return (vars[key] == null || key == "") && delete vars[key];
        });
      }
      return vars;
    };
  };

  ////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Register to window
  //
  if (window.edaplotjs) {
    window.edaplotjs.Util = Util;
  } else {
    window.edaplotjs = {};
    window.edaplotjs.Util = Util;
  }
})();