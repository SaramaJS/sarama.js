'user strict';

// Shim JavaScript objects that impersonate Python equivalents

function __pyListShim() {
  var arr = [];
  arr.push.apply(arr, arguments);
  Object.defineProperty(arr, "append",
  {
    value: function (x) {
      this.push(x);
    },
    enumerable: false
  });
  Object.defineProperty(arr, "extend",
  {
    value: function (L) {
      for (var i = 0; i < L.length; i++) this.push(L[i]);
    },
    enumerable: false
  });
  Object.defineProperty(arr, "insert",
  {
    value: function (i, x) {
      this.splice(i, 0, x);
    },
    enumerable: false
  });
  Object.defineProperty(arr, "remove",
  {
    value: function (x) {
      this.splice(this.indexOf(x), 1);
    },
    enumerable: false
  });
  Object.defineProperty(arr, "pop",
  {
    value: function (i) {
      if (!i)
        i = this.length - 1;
      var item = this[i];
      this.splice(i, 1);
      return item;
    },
    enumerable: false
  });
  Object.defineProperty(arr, "clear",
  {
    value: function () {
      this.splice(0, this.length);
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
  Object.defineProperty(arr, "copy",
  {
    value: function () {
      return this.slice(0);
    },
    enumerable: false
  });
  return arr;
}

// Python built-in functions

function int(s) {
  return parseInt(s);
}

function len(o) {
  return o.length;
}

function print() {
  var s = "";
  for (var i = 0; i < arguments.length; i++)
    s += i === 0 ? arguments[i] : " " + arguments[i];
  console.log(s);
}

function range(n) {
  var r = new __pyListShim();
  for (var i = 0; i < n; i++) r.append(i);
  return r;
}

// Python imports

var random = {
  random: function () { return Math.random(); }
}