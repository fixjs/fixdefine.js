/**
 * DefineJS v0.2.9 2015-04-16T23:09Z
 * Copyright (c) 2014 Mehran Hatami and define.js contributors.
 * Available via the MIT license.
 * license found at http://github.com/fixjs/define.js/raw/master/LICENSE
 */
(function (g, undefined) {
  
  var global = g();
  var fix = {
    options: {
      paths: null
    },
    modules: {},
    installed: {},
    waitingList: {},
    failedList: {},
    definedModules: {}
  };
  var urlCache = {};

  function isObject(value) {
    // Avoid a V8 JIT bug in Chrome 19-20.
    // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
    var type = typeof value;
    return type === 'function' || (value && type === 'object') || false;
  }

  function toObject(value) {
    return isObject(value) ? value : Object(value);
  }

  function forOwn(object, iteratee) {
    var iterable = toObject(object),
      props = Object.keys(iterable),
      length = props.length,
      index = -1,
      key;
    while (++index < length) {
      key = props[index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  }

  //This function solves #10 issue
  function loadMap(modulePath) {
    var depMap = fix.options.dependencyMap;
    forOwn(depMap, function (modulesList, fileName) {
      if (modulesList.indexOf(modulePath) > -1) {
        modulePath = fileName;
        return false;
      }
    });
    return modulePath;
  }
  var tags = {
    func: '[object Function]',
    opera: '[object Opera]',
    array: '[object Array]',
    string: '[object String]'
  };
  var objToString = Object.prototype.toString;

  var isFunction = function (value) {
    // Avoid a Chakra JIT bug in compatibility modes of IE 11.
    // See https://github.com/jashkenas/underscore/issues/1621 for more details.
    return typeof value === 'function' || false;
  };
  // Fallback for environments that return incorrect `typeof` operator results.
  if (isFunction(/x/) || (Uint8Array && !isFunction(Uint8Array))) {
    isFunction = function (value) {
      return objToString.call(value) === tags.func;
    };
  }
  var MAX_SAFE_INTEGER = Math.pow(2, 53) - 1;

  function isLength(value) {
    return typeof value === 'number' && value > -1 && value % 1 === 0 && value <= MAX_SAFE_INTEGER;
  }

  function each(array, iteratee) {
    var length = array ? array.length : 0;
    if (!isLength(length)) {
      return forOwn(array, iteratee);
    }
    var index = -1,
      iterable = toObject(array);

    while (++index < length) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return array;
  }

  function extract(base, path) {
    if (typeof path !== 'string') {
      return;
    }
    var parts = path.split('.');
    each(parts, function (part) {
      return isObject(base = base[part]);
    });
    return base;
  }

  function getShimObject(moduleName) {
    var shim = fix.options.shim && fix.options.shim[moduleName];
    if (!shim) {
      return false;
    }
    if (!isObject(shim.object)) {
      if (isFunction(shim.init)) {
        shim.object = shim.init.apply(global, arguments);
      }
      if (!isObject(shim.object)) {
        shim.object = extract(global, shim.exports);
      }
    }
    return shim.object;
  }
  var doc = global.document;

  function baseInfo() {
    var currentScript = doc.currentScript,
      filePathRgx = /^(.*[\\\/])/;
    //script injection when using BASE tag is now supported
    baseInfo.head = doc.head || doc.getElementsByTagName('head')[0];
    baseInfo.baseElement = doc.getElementsByTagName('base')[0];

    if (baseInfo.baseElement) {
      baseInfo.head = baseInfo.baseElement.parentNode;
    }

    //phantomjs does not provide the "currentScript" property in global document object
    if (currentScript) {
      baseInfo.baseUrl = currentScript.getAttribute('base') || currentScript.src.match(filePathRgx)[1];
      baseInfo.baseGlobal = currentScript.getAttribute('global');
    } else {
      baseInfo.baseUrl = '';
    }
  }
  baseInfo();

  function will(promise) {
    return {
      done: function (onFulfilled, onRejected) {
        var self = arguments.length ? promise.then.apply(promise, arguments) : promise;
        self.then(null, function (err) {
          setTimeout(function () {
            throw err;
          }, 0);
        });
      }
    };
  }

  function isObjectLike(value) {
    return (value && typeof value === 'object') || false;
  }

  function isPromiseAlike(obj) {
    return isObjectLike(obj) && isFunction(obj.then) || false;
  }

  function deferImpl(Promise) {
    function resolve(value, baseFulfill, baseReject, save) {
      var promise;
      if (isPromiseAlike(value)) {
        will(value).done(baseFulfill, baseReject);
        promise = value;
      } else {
        promise = new Promise(function (fulfill) {
          fulfill(value);
          baseFulfill(value);
        });
      }
      save(promise);
    }

    function reject(reason, baseReject, save) {
      save(new Promise(function (fulfill, reject) {
        reject(reason);
        baseReject(reason);
      }));
    }

    function defer() {
      var resolvedPromise,
        baseFulfill,
        baseReject,
        dfd = {},
        promise = new Promise(function (fulfill, reject) {
          baseFulfill = fulfill;
          baseReject = reject;
        });

      function save(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;
      }
      dfd.promise = promise;
      dfd.resolve = function (value) {
        if (resolvedPromise) {
          return;
        }
        resolve(value, baseFulfill, baseReject, save);
      };
      dfd.reject = function (reason) {
        if (resolvedPromise) {
          return;
        }
        reject(reason, baseReject, save);
      };
      return dfd;
    }
    return defer;
  }

  var GeneratorFunction;
  /* jshint ignore:start */
  GeneratorFunction = Object.getPrototypeOf(function * () {}).constructor;
  /* jshint ignore:end */

  function isGenerator(fn) {
    if (typeof fn === 'function') {
      //Function.prototype.isGenerator is supported in Firefox 5.0 or later
      //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/isGenerator
      if (typeof fn.isGenerator === 'function') {
        return fn.isGenerator();
      }
      return /^function\s*\*/.test(fn.toString());
    }
    return false;
  }

  var isArray = Array.isArray || function (value) {
    return (isObjectLike(value) && isLength(value.length) && objToString.call(value) === tags.array) || false;
  };

  var NativePromise = global.Promise,
    genCache = new Map();

  //A function by Forbes Lindesay which helps us code in synchronous style
  //using yield keyword, whereas the actual scenario is an asynchronous process
  //https://www.promisejs.org/generators/
  function forbesAsync(makeGenerator) {
    return function () {
      var generator = makeGenerator.apply(this, arguments);

      function handle(result) {
        // result => { done: [Boolean], value: [Object] }
        if (result.done) return Promise.resolve(result.value);

        return Promise.resolve(result.value).then(function (res) {
          return handle(generator.next(res));
        }, function (err) {
          return handle(generator.throw(err));
        });
      }

      try {
        return handle(generator.next());
      } catch (ex) {
        return Promise.reject(ex);
      }
    };
  }

  function async(makeGenerator) {
    var asyncGenerator;
    if (genCache.has(makeGenerator)) {
      return genCache.get(makeGenerator);
    }
    asyncGenerator = forbesAsync(makeGenerator);
    genCache.set(makeGenerator, asyncGenerator);
    return asyncGenerator;
  }

  GeneratorFunction.prototype.async = function () {
    return async(this);
  };
  GeneratorFunction.prototype.go = function () {
    return this.async().apply(undefined, arguments);
  };
  // Note: It is up to devs who use this prototype function to first check if isArray(args)
  GeneratorFunction.prototype.goWith = function (args) {
    return this.async().apply(undefined, args);
  };
  GeneratorFunction.prototype.goThen = function (onFulfilled, onRejected) {
    return this.goWith().then(onFulfilled, onRejected);
  };

  function makeAsync(fn) {
    return isGenerator(fn) ? fn.async() : fn;
  }

  function Promise(fn) {
    this.promise = isPromiseAlike(fn) ? fn : new NativePromise(makeAsync(fn));
  }
  Promise.prototype.then = function (onFulfilled, onRejected) {
    return new Promise(this.promise.then(makeAsync(onFulfilled), makeAsync(onRejected)));
  };
  Promise.prototype['catch'] = function (onRejected) {
    return new Promise(this.promise['catch'](makeAsync(onRejected)));
  };
  Promise.prototype.done = function (onFulfilled, onRejected) {
    will(this.promise).done(makeAsync(onFulfilled), makeAsync(onRejected));
  };
  Promise.all = function (obj) {
    return new Promise(NativePromise.all(obj));
  };
  Promise.race = function (obj) {
    return new Promise(NativePromise.race(obj));
  };
  Promise.resolve = function (obj) {
    return new Promise(NativePromise.resolve(obj));
  };
  Promise.reject = function (obj) {
    return new Promise(NativePromise.reject(obj));
  };
  Promise.async = async;

  var defer = deferImpl(Promise);

  function makeUrl(modulePath) {
    var url,
      urlArgs = (typeof fix.options.urlArgs === 'string') ?
      ('?' + fix.options.urlArgs) :
      (typeof fix.options.urlArgs === 'function') ? ('?' + fix.options.urlArgs()) : '';

    if (fix.options.baseUrl) {
      url = fix.options.baseUrl;
    } else {
      url = baseInfo.baseUrl;
    }

    forOwn(fix.options.paths, function (pathUrl, path) {
      if (typeof pathUrl === 'string' && modulePath.indexOf(path + '/') === 0) {
        modulePath = modulePath.replace(path, pathUrl);
        return false;
      }
    });

    if (url && url.charAt(url.length - 1) !== '/' && modulePath.charAt(0) !== '/') {
      url += '/';
    }
    url += modulePath + '.js' + urlArgs;
    return url;
  }

  function getUrl(url) {
    return urlCache[url] || (urlCache[url] = makeUrl(url));
  }

  var isOldOpera = isObjectLike(global.opera) && global.opera.toString() === tags.opera;

  var readyStateLoadedRgx = /^(complete|loaded)$/;

  function loadFN(callback) {
    return function fn(e) {
      var el = e.currentTarget || e.srcElement;
      if (e.type === 'load' || readyStateLoadedRgx.test(el.readyState)) {
        callback('success');
      }
      if (el.detachEvent && !isOldOpera) {
        el.detachEvent('onreadystatechange', fn);
      } else {
        el.removeEventListener('load', fn, false);
      }
    };
  }

  function errorFN(callback) {
    return function fn(e) {
      var el = e.currentTarget || e.srcElement;
      if (e.type === 'load' || readyStateLoadedRgx.test(el.readyState)) {
        callback('error');
      }
      if (typeof el.removeEventListener === 'function') {
        el.removeEventListener('error', fn, false);
      }
    };
  }

  function createScript(url) {
    var el,
      dfd = defer();
    //in case DefineJS were used along with something like svg in XML based use-cases,
    //then "xhtml" should be set to "true" like config({ xhtml: true });
    if (fix.options.xhtml) {
      el = doc.createElementNS('http://www.w3.org/1999/xhtml', 'script');
    } else {
      el = doc.createElement('script');
    }
    el.async = true;
    el.type = fix.options.scriptType || 'text/javascript';
    el.charset = 'utf-8';
    
    url = getUrl(url);

    if (el.attachEvent && !isOldOpera) {
      el.attachEvent('onreadystatechange', loadFN(dfd.resolve));
    } else {
      el.addEventListener('load', loadFN(dfd.resolve), false);
      el.addEventListener('error', errorFN(dfd.reject), false);
    }

    if (baseInfo.baseElement) {
      baseInfo.head.insertBefore(el, baseInfo.baseElement);
    } else {
      baseInfo.head.appendChild(el);
    }
    el.src = url;
    return dfd.promise;
  }

  function install(moduleName, status) {
    var callbacks;
    if (status === 'success') {
      if (fix.installed[moduleName]) {
        console.warn('[DefineJS][install][' + moduleName + ']: this module is already installed!');
        return;
      }
      fix.installed[moduleName] = true;
    } else {
      fix.failedList[moduleName] = true;
    }
    callbacks = fix.waitingList[moduleName];
    if (isArray(callbacks)) {
      each(callbacks, function (dfd) {
        try {
          dfd.resolve(fix.modules[moduleName]);
        } catch (err) {
          dfd.reject(err);
        }
      });
      callbacks.length = 0;
    }
  }

  function loadDemand(name, url, dfd) {
    var shimObject;
    //This solves #10 issue
    url = loadMap(url);

    //for those which are already loaded in the page
    shimObject = getShimObject(name);
    if (shimObject) {
      fix.modules[name] = shimObject;
      fix.installed[name] = true;
      dfd.resolve(shimObject);
    } else {
      if (urlCache[url] || fix.definedModules[name] || loader.loadShim(name, url, dfd)) {
        return;
      } else {
        createScript(url).then(function (status) {
          if (!fix.definedModules[name]) {
            install(name, status);
            dfd.resolve(fix.modules[name]);
          }
        });
      }
    }
  }

  var cleanUrlRgx = /[\?|#]([^]*)$/,
    fileNameRgx = /\/([^/]*)$/,
    cleanExtRgx = /.*?(?=\.|$)/;
  function matchUrl(url) {
    var fileName,
      matchResult;
    url = url.replace(cleanUrlRgx, '');
    fileName = (matchResult = url.match(fileNameRgx)) ? matchResult[1] : url;
    fileName = fileName.match(cleanExtRgx)[0];
    return fileName;
  }

  var files = {};
  function getFileName(url) {
    return files[url] || (files[url] = matchUrl(url));
  }

  function loadPromise(modulePath) {
    var dfd = defer(),
      isFirstLoadDemand = false,
      moduleName = getFileName(modulePath);

    if (fix.installed[moduleName]) {
      if (fix.modules[moduleName] !== undefined) {
        dfd.resolve(fix.modules[moduleName]);
      } else {
        dfd.reject(new Error(moduleName + ': has no returned module definition.'));
      }
    } else {
      if (!isArray(fix.waitingList[moduleName])) {
        fix.waitingList[moduleName] = [];
        isFirstLoadDemand = true;
      }
      fix.waitingList[moduleName].push(dfd);
      if (isFirstLoadDemand) {
        loadDemand(moduleName, modulePath, dfd);
      }
    }
    return dfd.promise;
  }

  function getShim(moduleName, modulePath, dfd) {
    return createScript(modulePath)
      .then(function (status) {
        fix.modules[moduleName] = getShimObject(moduleName);
        fix.waitingList[moduleName].push(dfd);
        install(moduleName, status);
      });
  }

  var globalPromise = new Promise(function (fulfill) {
      fulfill(global);
    }),
    promiseStorage = {
      global: globalPromise,
      g: globalPromise
    },
    loader;

  loader = {
    load: function load(modulePath) {
      if (promiseStorage[modulePath] === undefined) {
        promiseStorage[modulePath] = loadPromise(modulePath);
      }
      return promiseStorage[modulePath];
    },
    loadAll: function loadAll(list) {
      return Promise.all(list.map(loader.load));
    },
    loadShim: function (moduleName, modulePath, dfd) {
      var shim = fix.options.shim && fix.options.shim[moduleName];
      if (isObject(shim)) {
        if (shim.deps && shim.deps.length) {
          loader
            .loadAll(shim.deps)
            .then(function () {
              getShim(moduleName, modulePath, dfd);
            });
        } else {
          getShim(moduleName, modulePath, dfd);
        }
        return true;
      }
      return false;
    }
  };
  var emptyArray = [];

  function execute(fn, args) {
    var fnData,
      dfd = defer();
    if (!isArray(args)) {
      args = emptyArray;
    }
    if (isGenerator(fn)) {
      fn.invokeWith(args).then(dfd.resolve, dfd.reject);
    } else if (isFunction(fn)) {
      try {
        fnData = fn.apply(undefined, args);
        dfd.resolve(fnData);
      } catch (err) {
        dfd.reject(err);
      }
    } else {
      dfd.resolve(args);
    }
    return dfd.promise;
  }

  function isString(value) {
    return typeof value === 'string' || (isObjectLike(value) && objToString.call(value) === tags.string);
  }

  function setup(name, definition, deps) {
    var dfd = defer();
    if (!isString(name) || !isFunction(definition)) {
      dfd.reject(new TypeError('Expected a string and a function'));
      return;
    } else {
      return execute(definition, deps)
        .then(function (value) {
          fix.modules[name] = value;
          install(name, 'success');
          dfd.resolve(fix.modules[name]);
        });
    }
    return dfd.promise;
  }

  function fixDefine(name, list, definition) {
    fix.definedModules[name] = true;
    return loader
      .loadAll(list)
      .then(function (deps) {
        return setup(name, definition, deps);
      });
  }

  function setDepsHash(list, deps) {
    if (isArray(deps) && deps.length) {
      each(list, function (dep, index) {
        deps[dep] = deps[index];
      });
    }
  }

  function fixRequire(list, fn) {
    return loader
      .loadAll(list)
      .then(function (deps) {
        setDepsHash(list, deps);
        return execute(fn, deps);
      });
  }

  function core(_, amd) {
    if (!isObject(_)) {
      _ = global;
    }
    _.define = function (moduleName, array, moduleDefinition) {
      return core.define(amd, moduleName, array, moduleDefinition);
    };
    _.require = function (array, fn) {
      return amd.require(array, fn);
    };
    _.use = function (array) {
      return _.require(array);
    };
    _.config = function (cnfOptions) {
      if (!isObject(cnfOptions)) {
        console.error('Invalid parameter to set up the config');
        return;
      }
      forOwn(cnfOptions, function (option, key) {
        fix.options[key] = option;
      });
    };
    _.require.config = _.config;
    _.define.amd = {};
    _.define.fix = fix;
    _.define.defer = defer;
    return _;
  }

  core.define = function (amd, moduleName, array, moduleDefinition) {
    if (typeof moduleName === 'function') {
      //define(moduleDefinition)
      moduleDefinition = moduleName;
      moduleName = undefined;
      array = emptyArray;
    } else if (isArray(moduleName)) {
      //define(array, moduleDefinition)
      moduleDefinition = array;
      array = moduleName;
      moduleName = undefined;
    } else if (typeof moduleName === 'string') {
      //define(moduleName, moduleDefinition)
      if (typeof array === 'function') {
        moduleDefinition = array;
        array = emptyArray;
      }
    }
    if (typeof moduleDefinition !== 'function') {
      console.error('Invalid input parameter to define a module');
      return false;
    }
    if (moduleName === undefined) {
      moduleName = getFileName(document.currentScript.src);
    }
    return amd.define(moduleName, array, moduleDefinition);
  };

  function amd() {
    if (amd.definejs) {
      return amd.definejs;
    }
    var definejs = function (_) {
      _ = core(_, amd);

      function * loadGenerator(modulePath) {
        return yield loader.load(modulePath);
      }

      function CJS(definition) {
        return function * cjs() {
          var exportsObj = {},
            moduleObj = {
              exports: exportsObj
            };

          var data = yield definition.go(exportsObj, moduleObj);
          if (data) {
            return data;
          }

          if (moduleObj.exports !== exportsObj || Object.keys(exportsObj).length > 0) {
            return moduleObj.exports;
          }
        };
      }

      amd.define = function (moduleName, array, definition) {
        if (isGenerator(definition)) {
          return _.define(CJS(definition).async());
        }
        return fixDefine(moduleName, array, definition);
      };

      amd.require = function (array, fn) {
        if (typeof array === 'function' && isGenerator(array)) {
          return array.go();
        }
        if (typeof array === 'string' && typeof fn === 'undefined') {
          return loadGenerator.go(array);
        }
        return fixRequire(array, fn);
      };
      _.define.Promise = Promise;
    };
    amd.definejs = definejs;
    return definejs;
  }

  if (typeof exports === 'object') {
    module.exports = amd();
  } else if (typeof define === 'function' && define.amd) {
    define([], amd);
  } else {
    var definejs = amd();
    if (baseInfo.baseGlobal && isObject(global[baseInfo.baseGlobal])) {
      definejs(global[baseInfo.baseGlobal]);
    } else {
      global.definejs = definejs;
    }
  }
}(function g() {
  return this;
}));
