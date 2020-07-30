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
    var ua = navigator.userAgent;
    var isChromeOS = ua.match(/CrOS/) != null;
    var isMobileDevice = !isChromeOS && (ua.match(/Android/i) || ua.match(/webOS/i) || ua.match(/iPhone/i) || ua.match(/iPad/i) || ua.match(/iPod/i) || ua.match(/BlackBerry/i) || ua.match(/Windows Phone/i) || ua.match(/Mobile/i)) != null;
    var isIOSDevice = ua.match(/iPad|iPhone|iPod/) != null;
    var matchIOSVersionString = ua.match(/OS (\d+)_(\d+)_?(\d+)?/);
    var isSupportedIOSVersion = isIOSDevice && parseInt(matchIOSVersionString[1]) >= 11;
    var isAndroidDevice = ua.match(/Android/) != null;
    var matchAndroidVersionString = ua.match(/Android (\d+(?:\.*\d*){1,2})/);
    var isSupportedAndroidVersion = isAndroidDevice && parseFloat(matchAndroidVersionString[1]) >= 7
    var isMSIEUserAgent = ua.match(/MSIE|Trident|Edge/) != null;
    var isOperaUserAgent = ua.match(/OPR/) != null;
    var isChromeUserAgent = ua.match(/Chrome/) != null && !isMSIEUserAgent && !isOperaUserAgent;
    var matchChromeVersionString = ua.match(/Chrome\/([0-9.]+)/);
    var isSupportedChromeMobileVersion = matchChromeVersionString && matchChromeVersionString.length > 1 && parseInt(matchChromeVersionString[1]) >= 73;
    var isSamsungInternetUserAgent = ua.match(/SamsungBrowser/) != null;
    var isIEEdgeUserAgent = !!(isMSIEUserAgent && ua.match(/Edge\/([\d]+)/));

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Private methods
    //

    // This code is from https://github.com/CMU-CREATE-Lab/timemachine-viewer/blob/master/js/org/gigapan/util.js
    function isMobileSupported() {
      /* The following mobile browsers do not currently support autoplay of videos:
       *   - Samsung Internet (Last checked Mar 2019)
       */
      var isSupported = false;
      if (isMobileDevice && (isSupportedIOSVersion || isSupportedAndroidVersion)) {
        isSupported = true;
        if ((isChromeUserAgent && !isSupportedChromeMobileVersion) || isSamsungInternetUserAgent) {
          isSupported = false;
        }
      }
      return isSupported;
    }

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

    // Play or pause the videos properly
    // See https://developers.google.com/web/updates/2017/06/play-request-was-interrupted
    var handleVideoPromise = function (video, actionType, error_callback) {
      if (!video) return;
      if (actionType == "play" && video.paused && !video.playPromise) {
        if (video.readyState > 1) {
          video.playPromise = video.play();
        } else {
          // Do not add a new timeout if already exists
          if (!video.handle_video_promise_timeout) {
            console.warn("This video is not ready to play, will try later.");
            if (typeof video.retry_times === "undefined") {
              video.retry_times = 0
            }
            clearTimeout(video.handle_video_promise_timeout);
            video.handle_video_promise_timeout = setTimeout(function () {
              video.handle_video_promise_timeout = null;
              video.retry_times += 1;
              if (video.retry_times <= 3) {
                handleVideoPromise(video, actionType, error_callback);
              } else {
                video.retry_times = 0
                handleVideoPromise(video, "load", error_callback);
              }
            }, 1000);
          }
          return;
        }
      }
      // HTML5 video does not return Promises in <= IE 11, so we create a fake one.
      // Also note that <= IE11 does not support Promises, so we need to include a polyfill.
      if (isMSIEUserAgent && !isIEEdgeUserAgent) {
        video.playPromise = Promise.resolve(true);
      }
      if (video.playPromise !== undefined) {
        video.playPromise.then(function (_) {
          if (actionType == "pause" && video.played.length && !video.paused) {
            video.pause();
          } else if (actionType == "load") {
            video.load();
          }
          if (actionType != "play") {
            video.playPromise = undefined;
          }
        }).catch(function (error) {
          console.error(error.name, error.message);
          if (typeof error_callback === "function") error_callback();
        });
      }
    };
    this.handleVideoPromise = handleVideoPromise;

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
      var is_testing = url_hostname.indexOf("192.168");
      if (is_localhost >= 0 || is_testing >= 0) {
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

    // This code is from https://github.com/CMU-CREATE-Lab/timemachine-viewer/blob/master/js/org/gigapan/util.js
    this.browserSupported = function () {
      var v = document.createElement('video');

      // Restrictions on which mobile devices work
      if (isMobileDevice && !isMobileSupported()) return false;

      // Check if the video tag is supported
      if (!!!v.canPlayType) return false;

      // See what video formats are actually supported
      var supportedMediaTypes = [];
      if (!!v.canPlayType('video/webm; codecs="vp8"').replace(/no/, '')) {
        supportedMediaTypes.push(".webm");
      }
      if (!!v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/no/, '')) {
        supportedMediaTypes.push(".mp4");
      }

      // The current video format returned by the database is mp4, and is the only supported format now
      if (supportedMediaTypes.indexOf(".mp4") < 0) return false;

      // The viewer is supported by the browser
      return true;
    };

    // Is a DOM element on screen
    this.isScrolledIntoView = function (elem) {
      var docViewTop = $(window).scrollTop();
      var docViewBottom = docViewTop + $(window).height();

      var elemTop = $(elem).offset().top;
      var elemBottom = elemTop + $(elem).height();

      return ((docViewTop < elemBottom) && (elemTop < docViewBottom));
    };

    // Update label statistics
    this.updateLabelStatistics = function () {
      $.getJSON(getRootApiUrl() + "get_label_statistics", function (data) {
        var num_all_videos = data["num_all_videos"];
        $(".num-all-videos-text").text(num_all_videos);
        var num_fully_labeled = data["num_fully_labeled"];
        var num_fully_labeled_p = Math.round(num_fully_labeled / num_all_videos * 10000) / 100;
        $(".num-fully-labeled-text").text(num_fully_labeled + " (" + num_fully_labeled_p + "%)");
        var num_partially_labeled = data["num_partially_labeled"];
        var num_partially_labeled_p = Math.round(num_partially_labeled / num_all_videos * 10000) / 100;
        $(".num-partially-labeled-text").text(num_partially_labeled + " (" + num_partially_labeled_p + "%)");
        $("#label-statistics").show();
      });
    };

    // Resolve promises and call back
    this.resolvePromises = function (promises, callback) {
      callback = safeGet(callback, {});
      $.when.apply($, promises).done(function () {
        if (typeof callback["success"] === "function") callback["success"]();
      }).fail(function (xhr) {
        if (typeof callback["error"] === "function") callback["error"](xhr);
      })
    };

    // Randomize array element order in-place
    // Using Durstenfeld shuffle algorithm with O(n) time complexity
    this.shuffleArrayInPlace = function (array) {
      for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
      }
      return array;
    };

    // iOS 13 Safari did not clear the video tags before switching to a different page.
    // If we toggle between two pages that both have 16 videos for several times
    // , the video tags will break and give media error code 3 MEDIA_ERR_DECODE.
    // To prevent this, we need to manually clear these video tags before leaving the page.
    this.addVideoClearEvent = function () {
      window.addEventListener("pagehide", event => {
        $("video").each(function () {
          this.pause();
          this.src = "";
        });
      }, false);
    };

    // Get the Android version on the device
    this.getAndroidVersion = function () {
      if (isAndroidDevice) {
        return parseFloat(matchAndroidVersionString[1]);
      }
    };

    // Replace thumbnail width
    this.replaceThumbnailWidth = function (url) {
      return url.replace("/180/", "/320/").replace("-180-180-", "-320-320-").replace("width=180", "width=320").replace("height=180", "height=320");
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