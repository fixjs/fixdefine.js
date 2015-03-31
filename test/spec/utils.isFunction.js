define(function () {
  'use strict';

  function testIsFunction(assert, utils) {

    assert.strictEqual(typeof utils.isFunction, 'function', 'utils.isFunction is a function');

    //tests for environments that return incorrect `typeof` operator results.
    assert.equal(utils.isFunction(/x/), false, 'utils.isFunction works for regexps');

    if (navigator.userAgent.search('PhantomJS') === -1) {
      assert.equal(utils.isFunction(global.Uint8Array), true, 'utils.isFunction works for Uint8Array');
    }

    assert.strictEqual(utils.isFunction(/x/), false, 'utils.isFunction is a function');

    var global1 = fix.testFrame.contentWindow,
      f = global.Function(''),
      f1 = global1.Function('');

    assert.notEqual(global, global1, 'Two different window objects');
    assert.strictEqual(f1 instanceof global.Function, false, 'Functions are instances from within global objects:f1 in global');
    assert.strictEqual(f1 instanceof global1.Function, true, 'Functions are instances from within global objects:f1 in global1');
    assert.strictEqual(f instanceof global1.Function, false, 'Functions are instances from within global objects:f in global1');
    assert.strictEqual(f instanceof global.Function, true, 'Functions are instances from within global objects:f in global');
    assert.strictEqual(utils.isFunction(f), true, 'utils.isFunction works for all functions even from different globals:f');
    assert.strictEqual(utils.isFunction(f1), true, 'utils.isFunction works for all functions even from different globals:f1');
  }

  fix.test('utils.isFunction', {
    message: 'utils.isFunction works as a helper utils function',
    require: ['./utils']
  }).then(function (assert, utils) {

    assert.strictEqual(typeof utils, 'object', 'utils is a function');
    testIsFunction(assert, utils);

  });
});