"use strict";

// Python built-in functions

function print() {
  var s = "";
  for (var i = 0; i < arguments.length; i++)
    s += i === 0 ? arguments[i] : " " + arguments[i];
  console.log(s);
}

function range(n) {
  var r = [];
  for (var i = 0; i < n; i++) r.push(i);
  return r;
}
