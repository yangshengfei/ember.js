'no use strict';
// Remove "use strict"; from transpiled module until
// https://bugs.webkit.org/show_bug.cgi?id=138038 is fixed

import {
  functionMetaFor
} from 'ember-metal/function-meta';

/**
@module ember-metal
*/

/**
  Previously we used `Ember.$.uuid`, however `$.uuid` has been removed from
  jQuery master. We'll just bootstrap our own uuid now.

  @private
  @return {Number} the uuid
*/
let _uuid = 0;

/**
  Generates a universally unique identifier. This method
  is used internally by Ember for assisting with
  the generation of GUID's and other unique identifiers.

  @public
  @return {Number} [description]
 */
export function uuid() {
  return ++_uuid;
}

/**
  Prefix used for guids through out Ember.
  @private
  @property GUID_PREFIX
  @for Ember
  @type String
  @final
*/
const GUID_PREFIX = 'ember';

// Used for guid generation...
const numberCache  = [];
const stringCache  = {};

/**
  Strongly hint runtimes to intern the provided string.

  When do I need to use this function?

  For the most part, never. Pre-mature optimization is bad, and often the
  runtime does exactly what you need it to, and more often the trade-off isn't
  worth it.

  Why?

  Runtimes store strings in at least 2 different representations:
  Ropes and Symbols (interned strings). The Rope provides a memory efficient
  data-structure for strings created from concatenation or some other string
  manipulation like splitting.

  Unfortunately checking equality of different ropes can be quite costly as
  runtimes must resort to clever string comparison algorithms. These
  algorithms typically cost in proportion to the length of the string.
  Luckily, this is where the Symbols (interned strings) shine. As Symbols are
  unique by their string content, equality checks can be done by pointer
  comparison.

  How do I know if my string is a rope or symbol?

  Typically (warning general sweeping statement, but truthy in runtimes at
  present) static strings created as part of the JS source are interned.
  Strings often used for comparisons can be interned at runtime if some
  criteria are met.  One of these criteria can be the size of the entire rope.
  For example, in chrome 38 a rope longer then 12 characters will not
  intern, nor will segments of that rope.

  Some numbers: http://jsperf.com/eval-vs-keys/8

  Known Trick™

  @private
  @return {String} interned version of the provided string
*/
export function intern(str) {
  let obj = {};
  obj[str] = 1;
  for (let key in obj) {
    if (key === str) {
      return key;
    }
  }
  return str;
}

/**
  A unique key used to assign guids and other private metadata to objects.
  If you inspect an object in your browser debugger you will often see these.
  They can be safely ignored.

  On browsers that support it, these properties are added with enumeration
  disabled so they won't show up when you iterate over your properties.

  @private
  @property GUID_KEY
  @for Ember
  @type String
  @final
*/
const GUID_KEY = intern('__ember' + (+ new Date()));

export let GUID_DESC = {
  writable:     true,
  configurable: true,
  enumerable:   false,
  value: null
};

let nullDescriptor = {
  configurable: true,
  writable: true,
  enumerable: false,
  value: null
};

export let GUID_KEY_PROPERTY = {
  name: GUID_KEY,
  descriptor: nullDescriptor
};

/**
  Generates a new guid, optionally saving the guid to the object that you
  pass in. You will rarely need to use this method. Instead you should
  call `Ember.guidFor(obj)`, which return an existing guid if available.

  @private
  @method generateGuid
  @for Ember
  @param {Object} [obj] Object the guid will be used for. If passed in, the guid will
    be saved on the object and reused whenever you pass the same object
    again.

    If no object is passed, just generate a new guid.
  @param {String} [prefix] Prefix to place in front of the guid. Useful when you want to
    separate the guid into separate namespaces.
  @return {String} the guid
*/
export function generateGuid(obj, prefix) {
  if (!prefix) {
    prefix = GUID_PREFIX;
  }

  let ret = (prefix + uuid());
  if (obj) {
    if (obj[GUID_KEY] === null) {
      obj[GUID_KEY] = ret;
    } else {
      GUID_DESC.value = ret;
      if (obj.__defineNonEnumerable) {
        obj.__defineNonEnumerable(GUID_KEY_PROPERTY);
      } else {
        Object.defineProperty(obj, GUID_KEY, GUID_DESC);
      }
    }
  }
  return ret;
}

/**
  Returns a unique id for the object. If the object does not yet have a guid,
  one will be assigned to it. You can call this on any object,
  `Ember.Object`-based or not, but be aware that it will add a `_guid`
  property.

  You can also use this method on DOM Element objects.

  @public
  @method guidFor
  @for Ember
  @param {Object} obj any object, string, number, Element, or primitive
  @return {String} the unique guid for this instance.
*/
export function guidFor(obj) {
  if (obj && obj[GUID_KEY]) {
    return obj[GUID_KEY];
  }

  // special cases where we don't want to add a key to object
  if (obj === undefined) {
    return '(undefined)';
  }

  if (obj === null) {
    return '(null)';
  }

  let ret;
  let type = typeof obj;

  // Don't allow prototype changes to String etc. to change the guidFor
  switch (type) {
    case 'number':
      ret = numberCache[obj];

      if (!ret) {
        ret = numberCache[obj] = 'nu' + obj;
      }

      return ret;

    case 'string':
      ret = stringCache[obj];

      if (!ret) {
        ret = stringCache[obj] = 'st' + uuid();
      }

      return ret;

    case 'boolean':
      return obj ? '(true)' : '(false)';

    default:
      if (obj === Object) {
        return '(Object)';
      }

      if (obj === Array) {
        return '(Array)';
      }

      ret = GUID_PREFIX + uuid();

      if (obj[GUID_KEY] === null) {
        obj[GUID_KEY] = ret;
      } else {
        GUID_DESC.value = ret;

        if (obj.__defineNonEnumerable) {
          obj.__defineNonEnumerable(GUID_KEY_PROPERTY);
        } else {
          Object.defineProperty(obj, GUID_KEY, GUID_DESC);
        }
      }
      return ret;
  }
}

const HAS_SUPER_PATTERN = /\.(_super|call\(this|apply\(this)/;
const fnToString = Function.prototype.toString;

export const checkHasSuper = (function () {
  let sourceAvailable = fnToString.call(function() {
    return this;
  }).indexOf('return this') > -1;

  if (sourceAvailable) {
    return function checkHasSuper(func) {
      return HAS_SUPER_PATTERN.test(fnToString.call(func));
    };
  }

  return function checkHasSuper() {
    return true;
  };
}());

export const ROOT = (function() {
  function TERMINAL_SUPER_ROOT() {}

  // create meta for the terminal root
  let meta = functionMetaFor(TERMINAL_SUPER_ROOT);
  meta.writeHasSuper(false);

  return TERMINAL_SUPER_ROOT;
})();

function hasSuper(func, meta) {
  let hasSuper = meta.peekHasSuper();

  if (hasSuper === undefined) {
    hasSuper = checkHasSuper(func);
    meta.writeHasSuper(hasSuper);
  }

  return hasSuper;
}

/**
  Wraps the passed function so that `this._super` will point to the superFunc
  when the function is invoked. This is the primitive we use to implement
  calls to super.

  @private
  @method wrap
  @for Ember
  @param {Function} func The function to call
  @param {Function} superFunc The super function.
  @return {Function} wrapped function.
*/
export function wrap(func, superFunc) {
  let funcMeta = functionMetaFor(func);
  if (!hasSuper(func, funcMeta)) {
    return func;
  }

  let superFuncMeta = functionMetaFor(superFunc);
  // ensure an unwrapped super that calls _super is wrapped with a terminal _super
  if (!superFuncMeta.wrappedFunction && hasSuper(superFunc, superFuncMeta)) {
    let wrappedSuperFunc = _wrap(superFunc, ROOT);
    return _wrap(func, wrappedSuperFunc);
  }

  return _wrap(func, superFunc);
}

function _wrap(func, superFunc) {
  function superWrapper() {
    let orig = this._super;
    this._super = superFunc;
    let ret = func.apply(this, arguments);
    this._super = orig;
    return ret;
  }

  // setup the super wrapped functions meta
  functionMetaFor(superWrapper, func);

  return superWrapper;
}

/**
  Checks to see if the `methodName` exists on the `obj`.

  ```javascript
  let foo = { bar: function() { return 'bar'; }, baz: null };

  Ember.canInvoke(foo, 'bar'); // true
  Ember.canInvoke(foo, 'baz'); // false
  Ember.canInvoke(foo, 'bat'); // false
  ```

  @method canInvoke
  @for Ember
  @param {Object} obj The object to check for the method
  @param {String} methodName The method name to check for
  @return {Boolean}
  @private
*/
function canInvoke(obj, methodName) {
  return !!(obj && typeof obj[methodName] === 'function');
}

/**
  Checks to see if the `methodName` exists on the `obj`,
  and if it does, invokes it with the arguments passed.

  ```javascript
  let d = new Date('03/15/2013');

  Ember.tryInvoke(d, 'getTime');              // 1363320000000
  Ember.tryInvoke(d, 'setFullYear', [2014]);  // 1394856000000
  Ember.tryInvoke(d, 'noSuchMethod', [2014]); // undefined
  ```

  @method tryInvoke
  @for Ember
  @param {Object} obj The object to check for the method
  @param {String} methodName The method name to check for
  @param {Array} [args] The arguments to pass to the method
  @return {*} the return value of the invoked method or undefined if it cannot be invoked
  @public
*/
export function tryInvoke(obj, methodName, args) {
  if (canInvoke(obj, methodName)) {
    return args ? applyStr(obj, methodName, args) : applyStr(obj, methodName);
  }
}

// ........................................
// TYPING & ARRAY MESSAGING
//

const objectToString = Object.prototype.toString;

/**
  Forces the passed object to be part of an array. If the object is already
  an array, it will return the object. Otherwise, it will add the object to
  an array. If obj is `null` or `undefined`, it will return an empty array.

  ```javascript
  Ember.makeArray();            // []
  Ember.makeArray(null);        // []
  Ember.makeArray(undefined);   // []
  Ember.makeArray('lindsay');   // ['lindsay']
  Ember.makeArray([1, 2, 42]);  // [1, 2, 42]

  let controller = Ember.ArrayProxy.create({ content: [] });

  Ember.makeArray(controller) === controller;  // true
  ```

  @method makeArray
  @for Ember
  @param {Object} obj the object
  @return {Array}
  @private
*/
export function makeArray(obj) {
  if (obj === null || obj === undefined) { return []; }
  return Array.isArray(obj) ? obj : [obj];
}

/**
  Convenience method to inspect an object. This method will attempt to
  convert the object into a useful string description.

  It is a pretty simple implementation. If you want something more robust,
  use something like JSDump: https://github.com/NV/jsDump

  @method inspect
  @for Ember
  @param {Object} obj The object you want to inspect.
  @return {String} A description of the object
  @since 1.4.0
  @private
*/
export function inspect(obj) {
  if (obj === null) {
    return 'null';
  }
  if (obj === undefined) {
    return 'undefined';
  }
  if (Array.isArray(obj)) {
    return '[' + obj + ']';
  }
  // for non objects
  let type = typeof obj;
  if (type !== 'object' && type !== 'symbol') {
    return '' + obj;
  }
  // overridden toString
  if (typeof obj.toString === 'function' && obj.toString !== objectToString) {
    return obj.toString();
  }

  // Object.prototype.toString === {}.toString
  let v;
  let ret = [];
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      v = obj[key];
      if (v === 'toString') { continue; } // ignore useless items
      if (typeof v === 'function') { v = 'function() { ... }'; }

      if (v && typeof v.toString !== 'function') {
        ret.push(key + ': ' + objectToString.call(v));
      } else {
        ret.push(key + ': ' + v);
      }
    }
  }
  return '{' + ret.join(', ') + '}';
}

/**
  @param {Object} t target
  @param {String} m method
  @param {Array} a args
  @private
*/
export function applyStr(t, m, a) {
  let l = a && a.length;
  if (!a || !l) { return t[m](); }
  switch (l) {
    case 1:  return t[m](a[0]);
    case 2:  return t[m](a[0], a[1]);
    case 3:  return t[m](a[0], a[1], a[2]);
    case 4:  return t[m](a[0], a[1], a[2], a[3]);
    case 5:  return t[m](a[0], a[1], a[2], a[3], a[4]);
    default: return t[m].apply(t, a);
  }
}

export function lookupDescriptor(obj, keyName) {
  let current = obj;
  while (current) {
    let descriptor = Object.getOwnPropertyDescriptor(current, keyName);

    if (descriptor) {
      return descriptor;
    }

    current = Object.getPrototypeOf(current);
  }

  return null;
}

// A `toString` util function that supports objects without a `toString`
// method, e.g. an object created with `Object.create(null)`.
export function toString(obj) {
  if (obj && obj.toString) {
    return obj.toString();
  } else {
    return objectToString.call(obj);
  }
}

export {
  GUID_KEY,
  makeArray,
  canInvoke
};
