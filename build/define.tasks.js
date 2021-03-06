module.exports = function (grunt) {
  'use strict';

  var requirejs = require('./r'),
    pkg = grunt.file.readJSON('package.json'),
    rdefineEnd = /\}\);[^}\w]*$/,
    embedVersionRgx = /@VERSION/g,
    embedDateRgx = /@DATE/g,
    // yyyy-mm-ddThh:mmZ
    formatISODateRgx = /:\d+\.\d+Z$/,
    excluderRgx = /\/\*\s*ExcludeStart\s*\*\/[\w\W]*?\/\*\s*ExcludeEnd\s*\*\//gi;

  return function () {
    var version = pkg.version,
      done = this.async(),
      target = this.target,
      nameSuffix = (target === 'callback') ? '' : '.' + target,
      moduleName = 'define' + nameSuffix,
      name = moduleName + '.js',
      config;

    function writeTheCompiledFile(compiled) {
      var thisVeryMoment = (new Date()).toISOString()
        .replace(formatISODateRgx, 'Z');

      compiled = compiled
        .replace(embedVersionRgx, version)
        .replace(embedDateRgx, thisVeryMoment);

      grunt.file.write(name, compiled);
    }

    function compileAll(name, path, contents) {
      var amdName;
      // Detect variable modules
      if (/.\/var\//.test(path)) {
        contents = '  ' + contents
          .replace(/define\([\w\W]*?return/, 'var ' + (/var\/([\w-]+)/.exec(name)[1]) + ' =')
          .replace(rdefineEnd, '');

      } else {
        [
          [/\s*return\s+[^\}]+(\}\);[^\w\}]*)$/, '$1'],
          [/\s*exports\.\w+\s*=\s*\w+;/g, ''],
          [/define\([^{]*?{/, ''],
          [rdefineEnd, ''],
          [excluderRgx, ''],
          [/\/\/\s*BuildExclude\n\r?[\w\W]*?\n\r?/ig, ''],
          [/define\(\[[^\]]*\]\)[\W\n]+$/, '']
        ].forEach(function (item) {
          contents = contents.replace(item[0], item[1]);
        });
      }

      amdName = grunt.option('amd');
      if (amdName !== null && /^exports\/amd$/.test(name)) {
        if (amdName) {
          grunt.log.writeln('Naming DefineJS with AMD name: ' + amdName);
        } else {
          grunt.log.writeln('AMD name now anonymous');
        }
        // Remove the comma for anonymous defines
        contents = contents
          .replace(/(\s*)"define"(\,\s*)/, amdName ? '$1"' + amdName + '"$2' : '');
      }

      if (contents.charAt(contents.length - 1) === '\n') {
        // contents = contents.substring(1);
        contents = contents.substring(0, contents.length-1);
      }
      
      return contents;
    }

    config = {
      baseUrl: 'src/',
      optimize: 'none',
      findNestedDependencies: true,
      skipModuleInsertion: true,
      skipSemiColonInsertion: true,
      wrap: {
        startFile: 'build/define.prefix',
        endFile: 'build/define.suffix'
      },
      paths: {
        'define.amd': '../define.amd',
        'amd': 'amd' + nameSuffix
      },
      rawText: {
        definejs: 'define([]);'
      },
      name: 'define.amd',
      strict: true,
      onBuildWrite: compileAll,
      out: writeTheCompiledFile,

      include: []
    };

    if (target === 'promise') {
      config.paths.defer = 'defer.promise';
    }

    requirejs.optimize(config, function (response) {
      grunt.verbose.writeln(response);
      grunt.log.ok('File \'' + name + '\' created.');
      done();
    }, done);
  };
};