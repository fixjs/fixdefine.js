(function () {
  define("utils", [], function () {
    var e = {
      isObject: function (e) {
        return e === Object(e)
      },
      isString: function (e) {
        return typeof e == "string"
      }
    };
    return e
  }), define("app", ["utils"], function (e) {
    var t = {
      version: "0.2.9",
      options: {},
      lunch: function () {
        console.log("App just got lunched!")
      },
      utils: e
    };
    return t
  }), require(["app"], function (e) {
    e.utils.isObject(e.options) && console.log("1. utils.isObject(...) function is working as expected."), e.utils.isString(e.version) && console.log("2. utils.isString(...) function is working as expected."), e.lunch()
  }), define("main", function () {})
})();