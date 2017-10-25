// ## Python runtime library

module.exports = {

  // Shim JavaScript objects that impersonate Python equivalents

  // TODO: use 'type' or isSequence instead of 'instanceof Array' to id these

  internal: {
    // Only used within runtime
    isSeq: function (a) { return a && (a._type === "list" || a._type === "tuple"); },
    slice: function (obj, start, end, step) {
      if (step == null || step === 0) step = 1; // TODO: step === 0 is a runtime error
      if (start == null) {
        if (step < 0) start = obj.length - 1;
        else start = 0;
      } else if (start < 0) start += obj.length;
      if (end == null) {
        if (step < 0) end = -1;
        else end = obj.length;
      } else if (end < 0) end += obj.length;

      var ret = new pythonRuntime.objects.list(), tmp, i;
      if (step < 0) {
        tmp = obj.slice(end + 1, start + 1);
        for (i = tmp.length - 1; i >= 0; i += step) ret.append(tmp[i]);
      } else {
        tmp = obj.slice(start, end);
        if (step === 1) ret = pythonRuntime.utils.createList(tmp);
        else for (i = 0; i < tmp.length; i += step) ret.append(tmp[i]);
      }
      return ret;
    },
    isJSArray: Array.isArray || function(obj) {
      return toString.call(obj) === '[object Array]';
    }
  },

  utils: {
    createDict: function () {
      var ret = new pythonRuntime.objects.dict();
      if (arguments.length === 1 && arguments[0] instanceof Object)
        for (var k in arguments[0]) ret[k] = arguments[0][k];
      else
        throw TypeError("createDict expects a single JavaScript object");
      return ret;
    },
    createParamsObj: function () {
      // In: expr, expr, ..., {id:expr, __kwp:true}, {id:expr, __kwp:true}, ...
      // Out: {formals:[expr, expr, ...], keywords:{id:expr, id:expr, ...}}
      var params = { formals: new pythonRuntime.objects.list(), keywords: new PythonDict() };
      for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] && arguments[i].__kwp === true) {
          for (var k in arguments[i])
            if (k !== '__kwp') params.keywords[k] = arguments[i][k];
        }
        else params.formals.push(arguments[i]);
      }
      return params;
    },
    convertToList: function (list) {
      Object.defineProperties(list, pythonRuntime.utils.listPropertyDescriptor);
      return list;
    },
    convertToDict: function (dict) {
      Object.defineProperties(dict, pythonRuntime.utils.dictPropertyDescriptor);
      return dict;
    },
    listPropertyDescriptor: {
      "_type": {
        get: function () { return 'list'; },
        enumerable: false
      },
      "_isPython": {
        get: function () { return true; },
        enumerable: false
      },
      "append": {
        value: function (x) {
          this.push(x);
        },
        enumerable: false
      },
      "clear": {
        value: function () {
          this.splice(0, this.length);
        },
        enumerable: false
      },
      "copy": {
        value: function () {
          return this.slice(0);
        },
        enumerable: false
      },
      "count": {
        value: function (x) {
          var c = 0;
          for (var i = 0; i < this.length; i++)
            if (this[i] === x) c++;
          return c;
        },
        enumerable: false
      },
      "equals": {
        value: function (x) {
          try {
            if (this.length !== x.length) return false;
            for (var i = 0; i < this.length; i++) {
              if (this[i].hasOwnProperty("equals")) {
                if (!this[i].equals(x[i])) return false;
              } else if (this[i] !== x[i]) return false;
            }
            return true;
          }
          catch (e) { }
          return false;
        },
        enumerable: false
      },
      "extend": {
        value: function (L) {
          for (var i = 0; i < L.length; i++) this.push(L[i]);
        },
        enumerable: false
      },
      "index": {
        value: function (x) {
          return this.indexOf(x);
        },
        enumerable: false
      },
      "indexOf": {
        value: function (x, fromIndex) {
          try {
            for (var i = fromIndex ? fromIndex : 0; i < this.length; i++) {
              if (this[i].hasOwnProperty("equals")) {
                if (this[i].equals(x)) return i;
              } else if (this[i] === x) return i;
            }
          }
          catch (e) { }
          return -1;
        },
        enumerable: false
      },
      "insert": {
        value: function (i, x) {
          this.splice(i, 0, x);
        },
        enumerable: false
      },
      "pop": {
        value: function (i) {
          if (!i)
            i = this.length - 1;
          var item = this[i];
          this.splice(i, 1);
          return item;
        },
        enumerable: false
      },
      "_pySlice": {
        value: function (start, end, step) {
          return pythonRuntime.internal.slice(this, start, end, step);
        },
        enumerable: false
      },
      "remove": {
        value: function (x) {
          this.splice(this.indexOf(x), 1);
        },
        enumerable: false
      },
      "sort": {
        value: function(x, reverse) {
          var list2 = this.slice(0);
          var apply_key = function(a, numerical) {
            var list3 = list2.map(x);
            // construct a dict that maps the listay before and after the map
            var mapping = {}
            for(var i in list3) mapping[list3[i]] = list2[i];
            if(numerical)
              list3.sort(function(a, b) { return a - b; });
            else
              list3.sort()
            for(var i in a) a[i] = mapping[list3[i]];
          }
          for(var i in this) {
            if(typeof this[i] !== 'number' || !isFinite(this[i])) {
              if(typeof x != 'undefined') {
                apply_key(this, false);
              }
              else {
                list2.sort();
                for (var j in this) this[j] = list2[j];
              }
              if(reverse)
                this.reverse();
              return;
            }
          }
          if(typeof x != 'undefined') {
            apply_key(this, true);
          }
          else {
            list2.sort(function(a, b) { return a - b; });
            for(var i in this) this[i] = list2[i];
          }
          if(reverse)
            this.reverse();
        },
        enumerable: false
      },
      "toString": {
        value: function () {
          return '[' + this.join(', ') + ']';
        },
        enumerable: false
      }
    },
    createList: function () {
      var ret = new pythonRuntime.objects.list();
      if (arguments.length === 1 && arguments[0] instanceof Array)
        for (var i in arguments[0]) ret.push(arguments[0][i]);
      else
        for (var i in arguments) ret.push(arguments[i]);
      return ret;
    },
    dictPropertyDescriptor: {
      "_type": {
        get: function () { return 'dict';},
        enumerable: false
      },
      "_isPython": {
        get: function () { return true; },
        enumerable: false
      },
      "items": {
        value: function () {
          var items = new pythonRuntime.objects.list();
          for (var k in this) items.append(new pythonRuntime.objects.tuple(k, this[k]));
          return items;
        },
        enumerable: false
      },
      "length": {
        get: function () {
          return Object.keys(this).length;
        },
        enumerable: false
      },
      "clear": {
        value: function () {
          for (var i in this) delete this[i];
        },
        enumerable: false
      },
      "get": {
        value: function (key, def) {
          if (key in this) return this[key];
          else if (def !== undefined) return def;
          return null;
        },
        enumerable: false
      },
      "keys": {
        value: function () {
          return Object.keys(this);
        },
        enumerable: false
      },
      "pop": {
        value: function (key, def) {
          var value;
          if (key in this) {
            value = this[key];
            delete this[key];
          } else if (def !== undefined) value = def;
          else return new Error("KeyError");
          return value;
        },
        enumerable: false
      }, "values": {
        value: function () {
          var values = new pythonRuntime.objects.list();
          for (var key in this) values.append(this[key]);
          return values;
        },
        enumerable: false
      }
    }
  },
  ops: {
    add: function (a, b) {
      if (typeof a === 'object' && pythonRuntime.internal.isSeq(a) && pythonRuntime.internal.isSeq(b)) {
        if (a._type !== b._type)
          throw TypeError("can only concatenate " + a._type + " (not '" + b._type + "') to " + a._type);
        var ret;
        if (a._type === 'list') ret = new pythonRuntime.objects.list();
        else if (a._type === 'tuple') ret = new pythonRuntime.objects.tuple();
        if (ret) {
          for (var i = 0; i < a.length; i++) ret.push(a[i]);
          for (var i = 0; i < b.length; i++) ret.push(b[i]);
          return ret;
        }
      }
      return a + b;
    },
    in: function (a, b, n) {
      var r = b.hasOwnProperty('indexOf') ? b.indexOf(a) >= 0 : a in b;
      return n ? !r : r;
    },
    multiply: function (a, b) {
      // TODO: non-sequence operand must be an integer
      if ( typeof a === 'object' ) {
        if (pythonRuntime.internal.isSeq(a) && !isNaN(parseInt(b))) {
          var ret;
          if (a._type === 'list') ret = new pythonRuntime.objects.list();
          else if (a._type === 'tuple') ret = new pythonRuntime.objects.tuple();
          if (ret) {
            for (var i = 0; i < b; i++)
              for (var j = 0; j < a.length; j++) ret.push(a[j]);
            return ret;
          }
        } else if (pythonRuntime.internal.isSeq(b) && !isNaN(parseInt(a))) {
          var ret;
          if (b._type === 'list') ret = new pythonRuntime.objects.list();
          else if (b._type === 'tuple') ret = new pythonRuntime.objects.tuple();
          if (ret) {
            for (var i = 0; i < a; i++)
              for (var j = 0; j < b.length; j++) ret.push(b[j]);
            return ret;
          }
        }
      }
      return a * b;
    },
    subscriptIndex: function (o, i) {
      if ( i >= 0 ) return i;
      if ( pythonRuntime.internal.isSeq(o) ) return o.length + i;
      if ( pythonRuntime.internal.isJSArray(o) ) return o.length + i;
      if ( typeof o === "string" ) return o.length + i;
      return i;
    }
  },

  objects: {
    dict: function () {
      var obj = new PythonDict();
      for (var i = 0; i < arguments.length; ++i ) obj[arguments[i][0]] = arguments[i][1];
      return obj;
    },
    list: function () {
      var arr = [];
      arr.push.apply(arr, arguments);
      pythonRuntime.utils.convertToList(arr);
      return arr;
    },
    tuple: function () {
      var arr = [];
      arr.push.apply(arr, arguments);
      Object.defineProperty(arr, "_type",
        {
          get: function () { return 'tuple'; },
          enumerable: false
        });
      Object.defineProperty(arr, "_isPython",
        {
          get: function () { return true; },
          enumerable: false
        });
      Object.defineProperty(arr, "count",
        {
          value: function (x) {
            var c = 0;
            for (var i = 0; i < this.length; i++)
              if (this[i] === x) c++;
            return c;
          },
          enumerable: false
        });
      Object.defineProperty(arr, "equals",
        {
          value: function (x) {
            try {
              if (this.length !== x.length) return false;
              for (var i = 0; i < this.length; i++) {
                if (this[i].hasOwnProperty("equals")) {
                  if (!this[i].equals(x[i])) return false;
                } else if (this[i] !== x[i]) return false;
              }
              return true;
            }
            catch (e) { }
            return false;
          },
          enumerable: false
        });
      Object.defineProperty(arr, "index",
        {
          value: function (x) {
            return this.indexOf(x);
          },
          enumerable: false
        });
      Object.defineProperty(arr, "indexOf",
        {
          value: function (x, fromIndex) {
            try {
              for (var i = fromIndex ? fromIndex : 0; i < this.length; i++) {
                if (this[i].hasOwnProperty("equals")) {
                  if (this[i].equals(x)) return i;
                } else if (this[i] === x) return i;
              }
            }
            catch (e) { }
            return -1;
          },
          enumerable: false
        });
      Object.defineProperty(arr, "_pySlice",
        {
          value: function (start, end, step) {
            return pythonRuntime.internal.slice(this, start, end, step);
          },
          enumerable: false
        });
      Object.defineProperty(arr, "toString",
        {
          value: function () {
            var s = '(' + this.join(', ');
            if (this.length === 1) s += ',';
            s += ')';
            return s;
          },
          enumerable: false
        });
      return arr;
    }
  },

  // Python built-in functions

  functions: {
    abs: function(x) {
      return Math.abs(x);
    },
    all: function(iterable) {
      for (var i in iterable) if (pythonRuntime.functions.bool(iterable[i]) !== true) return false;
      return true;
    },
    any: function(iterable) {
      for (var i in iterable) if (pythonRuntime.functions.bool(iterable[i]) === true) return true;
      return false;
    },
    ascii: function(obj) {
      var s = pythonRuntime.functions.repr(obj),
        asc = "",
        code;
      for (var i = 0; i < s.length; i++) {
        code = s.charCodeAt(i);
        if (code <= 127) asc += s[i];
        else if (code <= 0xFF) asc += "\\x" + code.toString(16);
        else if (0xD800 <= code && code <= 0xDBFF) { // UCS-2 for the astral chars
          // if (i+1 >= s.length) throw "High surrogate not followed by low surrogate"; // Is this needed?
          code = ((code-0xD800)*0x400)+(s.charCodeAt(++i)-0xDC00)+0x10000;
          asc += "\\U" + ("000"+code.toString(16)).slice(-8);
        } else if (code <= 0xFFFF) asc += "\\u" + ("0"+code.toString(16)).slice(-4);
        else if (code <= 0x10FFFF) asc += "\\U" + ("000"+code.toString(16)).slice(-8);
        else; // Invalid value, should probably throw something. It should never get here though as strings shouldn't contain them in the first place
      }
      return asc;
    },
    bool: function(x) {
      return !(x === undefined || // No argument
        x === null || // None
        x === false || // False
        x === 0 || // Zero
        x.length === 0 || // Empty Sequence
        // TODO: Empty Mapping, needs more support for python mappings first
        (x.__bool__ !== undefined && x.__bool__() === false) || // If it has bool conversion defined
        (x.__len__ !== undefined && (x.__len__() === false || x.__len__() === 0))); // If it has length conversion defined
    },
    chr: function(i) {
      return String.fromCharCode(i); // TODO: Error code for not 0 <= i <= 1114111
    },
    divmod: function(a, b) {
      return pythonRuntime.objects.tuple(Math.floor(a/b), a%b);
    },
    enumerate: function(iterable, start) {
      start = start || 0;
      var ret = new pythonRuntime.objects.list();
      for (var i in iterable) ret.push(new pythonRuntime.objects.tuple(start++, iterable[i]));
      return ret;
    },
    filter: function(fn, iterable) {
      fn = fn || function () { return true; };
      var ret = new pythonRuntime.objects.list();
      for (var i in iterable) if (fn(iterable[i])) ret.push(iterable[i]);
      return ret;
    },
    float: function(x) {
      if (x === undefined) return 0.0;
      else if (typeof x == "string") { // TODO: Fix type check
        x = x.trim().toLowerCase();
        if ((/^[+-]?inf(inity)?$/i).exec(x) !== null) return Infinity*(x[0]==="-"?-1:1);
        else if ((/^nan$/i).exec(x) !== null) return NaN;
        else return parseFloat(x);
      } else if (typeof x == "number") { // TODO: Fix type check
        return x; // TODO: Get python types working right so we can return an actual float
      } else {
        if (x.__float__ !== undefined) return x.__float__();
        else return null; // TODO: Throw TypeError: float() argument must be a string or a number, not '<type of x>'
      }
    },
    hex: function(x) {
      return x.toString(16);
    },
    int: function (s) {
      return parseInt(s);
    },
    len: function (o) {
      return o.length;
    },
    list: function (iterable) {
      var ret = new pythonRuntime.objects.list();
      if (iterable instanceof Array) for (var i in iterable) ret.push(iterable[i]);
      else for (var i in iterable) ret.push(i);
      return ret;
    },
    map: function(fn, iterable) {
      // TODO: support additional iterables passed
      var ret = new pythonRuntime.objects.list();
      for (var i in iterable) ret.push(fn(iterable[i]));
      return ret;
    },
    max: function(arg1, arg2) {
      // TODO: support optional keyword-only arguments
      // TODO: empty iterable raises Python ValueError
      if (!arg2) { // iterable
        var max = null;
        for (var i in arg1) if (max === null || arg1[i] > max) max = arg1[i];
        return max;
      } else return arg1 >= arg2 ? arg1 : arg2;
    },
    min: function(arg1, arg2) {
      // TODO: support optional keyword-only arguments
      // TODO: empty iterable raises Python ValueError
      if (!arg2) { // iterable
        var max = null;
        for (var i in arg1) if (max === null || arg1[i] < max) max = arg1[i];
        return max;
      } else return arg1 <= arg2 ? arg1 : arg2;
    },
    oct: function(x) {
      return x.toString(8);
    },
    ord: function(c) {
      return c.charCodeAt(0);
    },
    pow: function(x, y, z) {
      return z ? Math.pow(x, y) % z : Math.pow(x, y);
    },
    print: function () {
      var s = "";
      for (var i = 0; i < arguments.length; i++)
        s += i === 0 ? arguments[i] : " " + arguments[i];
      console.log(s);
    },
    range: function (start, stop, step) {
      if (stop === undefined) {
        stop = start;
        start = 0;
        step = 1;
      }
      else if (step === undefined) step = 1;
      var len = ~~((stop - start) / step); //~~ is a fast floor
      var r = new Array(len);
      var element = 0;
      if (start < stop && step > 0 || start > stop && step < 0) {
        var i = start;
        while (i < stop && step > 0 || i > stop && step < 0) {
          r[element++] = i;
          i += step;
        }
      }
      pythonRuntime.utils.convertToList(r);
      return r;
    },
    repr: function (obj) {
      if (typeof obj === 'string') return "'" + obj + "'"; // TODO: Patch until typesystem comes up.
      if (obj.__repr__ !== undefined) return obj.__repr__();
      else if (obj.__class__ !== undefined && obj.__class__.module !== undefined && obj.__class__.__name__) {
        return '<'+obj.__class__.__module__+'.'+obj.__class__.__name__+' object>';
      } else return obj.toString(); // Raise a please report warning here, we should never reach this piece of code
    },
    reversed: function (seq) {
      var ret = new pythonRuntime.objects.list();
      for (var i in seq) ret.push(seq[i]);
      return ret.reverse();
    },
    round: function (num, ndigits) {
      if (ndigits) {
        var scale = Math.pow(10, ndigits);
        return Math.round(num * scale) / scale;
      }
      return Math.round(num);
    },
    sorted: function (iterable, key, reverse) {
      var ret = new pythonRuntime.objects.list();
      for (var i in iterable) ret.push(iterable[i]);
      if(key) ret.sort(key); else ret.sort();
      if (reverse) ret.reverse();
      return ret;
    },
    str: function (obj) {
      return obj.toString();
    },
    sum: function (iterable, start) {
      // TODO: start can't be a string
      var ret = start || 0;
      for (var i in iterable) ret += iterable[i];
      return ret;
    },
    tuple: function (iterable) {
      var ret = new pythonRuntime.objects.tuple();
      for (var i in iterable) ret.push(iterable[i]);
      return ret;
    }
  },

  // Python imports
  // TODO: from x import y, z

  imports: {
    random: {
      random: function () { return Math.random(); }
    }
  }
};


function PythonDict() {

}

Object.defineProperties(PythonDict.prototype, pythonRuntime.utils.dictPropertyDescriptor);