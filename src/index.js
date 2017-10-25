// sarama.js is a Python Mozilla ast parser written in JavaScript.
//
// sarama.js was written by many contributors and released under an MIT
// license. It was adatped from [Acorn](https://github.com/marijnh/acorn.git)
// by Marijn Haverbeke & Matt Lott.
//
// Git repository for Filbert are available at
//
//     https://github.com/SaramaJS/sarama.js.git
//
// Please use the [github bug tracker][ghbt] to report issues.
//
// [ghbt]: https://github.com/SaramaJS/sarama.js/issues
"use strict";

const IndentHistory = require('./indent-history');
const Scope = require('./scope');
const tokenTypes = require('./token-types');

exports.version = "0.5.1";

// The main exported interface (under `self.filbert` when in the
// browser) is a `parse` function that takes a code string and
// returns an abstract syntax tree as specified by [Mozilla parser
// API][api].
//
// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

class Sarama {
  static get defaults() {
    return {
      // `languageVersion` indicates the Python version to parse. It
      // is not currently in use, but will support 2 or 3 eventually.
      languageVersion: 3,
      // When `allowTrailingCommas` is false, the parser will not allow
      // trailing commas in array and object literals.
      allowTrailingCommas: true,
      // When enabled, a return at the top level is not considered an
      // error.
      allowReturnOutsideFunction: false,
      // When `locations` is on, `loc` properties holding objects with
      // `start` and `end` properties in `{line, column}` form (with
      // line being 1-based and column 0-based) will be attached to the
      // nodes.
      locations: false,
      // A function can be passed as `onComment` option, which will
      // cause Filbert to call that function with `(text, start,
      // end)` parameters whenever a comment is skipped.
      // `text` is the content of the comment, and `start` and `end` are
      // character offsets that denote the start and end of the comment.
      // When the `locations` option is on, two more parameters are
      // passed, the full `{line, column}` locations of the start and
      // end of the comments. Note that you are not allowed to call the
      // parser from the callback-that will corrupt its internal state.
      onComment: null,
      // [semi-standardized][range] `range` property holding a `[start,
      // end]` array with the same numbers, set the `ranges` option to
      // `true`.
      //
      // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
      ranges: false,
      // It is possible to parse multiple files into a single AST by
      // passing the tree produced by parsing the first file as
      // `program` option in subsequent parses. This will add the
      // toplevel forms of the parsed file to the `Program` (top) node
      // of an existing parse tree.
      program: null,
      // When `locations` is on, you can pass this to record the source
      // file in every node's `loc` object.
      sourceFile: null,
      // This value, if given, is stored in every node, whether
      // `locations` is on or off.
      directSourceFile: null,
      // Python runtime library object name
      runtimeParamName: "__pythonRuntime"
    };
  }

  constructor(input, options) {
    this.input = input;
    this.inputLength = input.length;
    this.locations = null;
    this.ranges = null;
    this.indentHistory = null;
    this.scope = null;
    this.tokCurLine = null;
    this.tokPos = null;
    this.tokLineStart = null;
    this.tokRegexpAllowed = null;
    this.newAstIdCount = null;
    this.setOptions(options)
      .initTokenState();
    this.nc = getNodeCreator(startNode, startNodeFrom, finishNode, unpackTuple);
  }

  setOptions(options = {}) {
    const defaults = Sarama.defaults;
    for (const p in defaults) {
      if (!defaults.hasOwnProperty(p)) continue;
      this[p] =  options.hasOwnProperty(p) ? options[p] : defaults[p];
    }
    return this;
  }

  initTokenState() {
    this.tokCurLine = 1;
    this.tokPos = 0;
    this.tokLineStart = 0;
    this.tokRegexpAllowed = true;
    this.indentHistory = new IndentHistory();
    this.newAstIdCount = 0;
    this.scope = new Scope();
    return this;
  }
}

// The `getLineInfo` function is mostly useful when the
// `locations` option is off (for performance reasons) and you
// want to find the line/column position for a given character
// offset. `input` should be the code string that the offset refers
// into.

var getLineInfo = exports.getLineInfo = function(input, offset) {
  for (var line = 1, cur = 0;;) {
    lineBreak.lastIndex = cur;
    var match = lineBreak.exec(input);
    if (match && match.index < offset) {
      ++line;
      cur = match.index + match[0].length;
    } else break;
  }
  return {line: line, column: offset - cur};
};

// State is kept in (closure-)global variables. We already saw the
// `options`, `input`, and `inputLen` variables above.

// The current position of the tokenizer in the input.

var tokPos;

// The start and end offsets of the current token.

var tokStart, tokEnd;

// When `options.locations` is true, these hold objects
// containing the tokens start and end line/column pairs.

var tokStartLoc, tokEndLoc;

// The type and value of the current token. Token types are objects,
// named by variables against which they can be compared, and
// holding properties that describe them (indicating, for example,
// the precedence of an infix operator, and the original name of a
// keyword token). The kind of value that's held in `tokVal` depends
// on the type of the token. For literals, it is the literal value,
// for operators, the operator name, and so on.

var tokType, tokVal;

// Interal state for the tokenizer. To distinguish between division
// operators and regular expressions, it remembers whether the last
// token was one that is allowed to be followed by an expression.
// (If it is, a slash is probably a regexp, if it isn't it's a
// division operator. See the `parseStatement` function for a
// caveat.)

var tokRegexpAllowed;

// When `options.locations` is true, these are used to keep
// track of the current line, and know when a new line has been
// entered.

var tokCurLine, tokLineStart;

// These store the position of the previous token, which is useful
// when finishing a node and assigning its `end` position.

var lastStart, lastEnd, lastEndLoc;

// This is the parser's state. `inFunction` is used to reject
// `return` statements outside of functions, `strict` indicates
// whether strict mode is on, and `bracketNesting` tracks the level
// of nesting within brackets for implicit lint continuation.

var inFunction, strict, bracketNesting;

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

function raise(pos, message) {
  var loc = getLineInfo(input, pos);
  var err = new SyntaxError(message);
  err.pos = pos; err.loc = loc; err.raisedAt = tokPos;
  throw err;
}

// Reused empty array added for node fields that are always empty.

var empty = [];

// Used for name collision avoidance whend adding extra AST identifiers

var newAstIdCount = 0;

var indentHist = exports.indentHist = ;

// ## Scope

// Collection of namespaces saved as a stack
// A namespace is a mapping of identifiers to 3 types: variables, functions, classes
// A namespace also knows whether it is for global, class, or function
// A new namespace is pushed at function and class start, and popped at their end
// Starts with a global namespace on the stack
// E.g. scope.namespaces ~ [{type: 'g', map:{x: 'v', MyClass: 'c'} }, ...]





// This is a trick taken from Esprima. It turns out that, on
// non-Chrome browsers, to check whether a string is in a set, a
// predicate containing a big ugly `switch` statement is faster than
// a regular expression, and on Chrome the two are about on par.
// This function uses `eval` (non-lexical) to produce such a
// predicate from a space-separated string of words.
//
// It starts by sorting the words by length.

function makePredicate(words) {
  words = words.split(" ");
  var f = "", cats = [];
  out: for (var i = 0; i < words.length; ++i) {
    for (var j = 0; j < cats.length; ++j)
      if (cats[j][0].length == words[i].length) {
        cats[j].push(words[i]);
        continue out;
      }
    cats.push([words[i]]);
  }
  function compareTo(arr) {
    if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
    f += "switch(str){";
    for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
    f += "return true}return false;";
  }

  // When there are more than three length categories, an outer
  // switch first dispatches on the lengths, to save on comparisons.

  if (cats.length > 3) {
    cats.sort(function(a, b) {return b.length - a.length;});
    f += "switch(str.length){";
    for (var i = 0; i < cats.length; ++i) {
      var cat = cats[i];
      f += "case " + cat[0].length + ":";
      compareTo(cat);
    }
    f += "}";

    // Otherwise, simply generate a flat `switch` statement.

  } else {
    compareTo(words);
  }
  return new Function("str", f);
}

// The forbidden variable names

var isStrictBadIdWord = makePredicate("eval arguments");

// Keywords
// TODO: dict isn't a keyword, it's a builtin

var isKeyword = makePredicate("dict False None True and as assert break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield");

// ## Character categories

// Big ugly regular expressions that match characters in the
// whitespace, identifier, and identifier-start categories. These
// are only applied when a character is found to actually have a
// code point above 128.

var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";
var nonASCIIidentifierChars = "\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u0620-\u0649\u0672-\u06d3\u06e7-\u06e8\u06fb-\u06fc\u0730-\u074a\u0800-\u0814\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0840-\u0857\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09d7\u09df-\u09e0\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5f-\u0b60\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2-\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d46-\u0d48\u0d57\u0d62-\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e34-\u0e3a\u0e40-\u0e45\u0e50-\u0e59\u0eb4-\u0eb9\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f41-\u0f47\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1029\u1040-\u1049\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u170e-\u1710\u1720-\u1730\u1740-\u1750\u1772\u1773\u1780-\u17b2\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1920-\u192b\u1930-\u193b\u1951-\u196d\u19b0-\u19c0\u19c8-\u19c9\u19d0-\u19d9\u1a00-\u1a15\u1a20-\u1a53\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b46-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1bb0-\u1bb9\u1be6-\u1bf3\u1c00-\u1c22\u1c40-\u1c49\u1c5b-\u1c7d\u1cd0-\u1cd2\u1d00-\u1dbe\u1e01-\u1f15\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2d81-\u2d96\u2de0-\u2dff\u3021-\u3028\u3099\u309a\ua640-\ua66d\ua674-\ua67d\ua69f\ua6f0-\ua6f1\ua7f8-\ua800\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8f3-\ua8f7\ua900-\ua909\ua926-\ua92d\ua930-\ua945\ua980-\ua983\ua9b3-\ua9c0\uaa00-\uaa27\uaa40-\uaa41\uaa4c-\uaa4d\uaa50-\uaa59\uaa7b\uaae0-\uaae9\uaaf2-\uaaf3\uabc0-\uabe1\uabec\uabed\uabf0-\uabf9\ufb20-\ufb28\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";
var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

// Whether a single character denotes a newline.

var newline = /[\n\r\u2028\u2029]/;

// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

var lineBreak = /\r\n|[\n\r\u2028\u2029]/g;

// Test whether a given character code starts an identifier.

var isIdentifierStart = exports.isIdentifierStart = function(code) {
  if (code < 65) return code === 36;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123)return true;
  return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
};

// Test whether a given character is part of an identifier.

var isIdentifierChar = exports.isIdentifierChar = function(code) {
  if (code < 48) return code === 36;
  if (code < 58) return true;
  if (code < 65) return false;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123)return true;
  return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
};





// ## Node creation utilities

var getNodeCreator = exports.getNodeCreator = function(startNode, startNodeFrom, finishNode, unpackTuple) {


};

// Predicate that tests whether the next token is of the given
// type, and if yes, consumes it as a side effect.

function eat(type) {
  if (tokType === type) {
    next();
    return true;
  }
}

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error.

function expect(type) {
  if (tokType === type) next();
  else unexpected();
}

// Raise an unexpected token error.

function unexpected() {
  raise(tokStart, "Unexpected token");
}

// Verify that a node is an lval - something that can be assigned
// to.

function checkLVal(expr) {
  if (expr.type !== "Identifier" && expr.type !== "MemberExpression")
    raise(expr.start, "Assigning to rvalue");
  if (strict && expr.type === "Identifier" && isStrictBadIdWord(expr.name))
    raise(expr.start, "Assigning to " + expr.name + " in strict mode");
}

// Get args for a new tuple expression

function getTupleArgs(expr) {
  if (expr.callee && expr.callee.object && expr.callee.object.object &&
    expr.callee.object.object.name === options.runtimeParamName &&
    expr.callee.property && expr.callee.property.name === "tuple")
    return expr.arguments;
  return null;
}

// Unpack an lvalue tuple into indivual variable assignments
// 'arg0, arg1 = right' becomes:
// var tmp = right
// arg0 = tmp[0]
// arg1 = tmp[1]
// ...

function unpackTuple(tupleArgs, right) {
  if (!tupleArgs || tupleArgs.length < 1) unexpected();

  var varStmts = [];

  // var tmp = right

  var tmpId = nc.createNodeSpan(right, right, "Identifier", { name: "__filbertTmp" + newAstIdCount++ });
  var tmpDecl = nc.createVarDeclFromId(right, tmpId, right);
  varStmts.push(tmpDecl);

  // argN = tmp[N]

  for (var i = 0; i < tupleArgs.length; i++) {
    var lval = tupleArgs[i];
    var subTupleArgs = getTupleArgs(lval);
    if (subTupleArgs) {
      var subLit = nc.createNodeSpan(right, right, "Literal", { value: i });
      var subRight = nc.createNodeSpan(right, right, "MemberExpression", { object: tmpId, property: subLit, computed: true });
      var subStmts = unpackTuple(subTupleArgs, subRight);
      for (var j = 0; j < subStmts.length; j++) varStmts.push(subStmts[j]);
    } else {
      checkLVal(lval);
      var indexId = nc.createNodeSpan(right, right, "Literal", { value: i });
      var init = nc.createNodeSpan(right, right, "MemberExpression", { object: tmpId, property: indexId, computed: true });
      if (lval.type === "Identifier" && !scope.exists(lval.name)) {
        scope.addVar(lval.name);
        var varDecl = nc.createVarDeclFromId(lval, lval, init);
        varStmts.push(varDecl);
      }
      else {
        var node = startNodeFrom(lval);
        node.left = lval;
        node.operator = "=";
        node.right = init;
        finishNode(node, "AssignmentExpression");
        varStmts.push(nc.createNodeFrom(node, "ExpressionStatement", { expression: node }));
      }
    }
  }

  return varStmts;
}

// ### Statement parsing

// Parse a program. Initializes the parser, reads any number of
// statements, and wraps them in a Program node.  Optionally takes a
// `program` argument.  If present, the statements will be appended
// to its body instead of creating a new node.

function parseTopLevel(program) {
  lastStart = lastEnd = tokPos;
  if (options.locations) lastEndLoc = new Position;
  inFunction = strict = null;
  bracketNesting = 0;
  readToken();
  var node = program || startNode();
  if (!program) node.body = [];
  while (tokType !== _eof) {
    var stmt = parseStatement();
    if (stmt) node.body.push(stmt);
  }
  return finishNode(node, "Program");
}

// Parse a single statement.
//
// If expecting a statement and finding a slash operator, parse a
// regular expression literal. This is to handle cases like
// `if (foo) /blah/.exec(foo);`, where looking at the previous token
// does not help.

function parseStatement() {
  if (tokType === tokenTypes.slash || tokType === tokenTypes.assign && tokVal == "/=")
    readToken(true);

  var starttype = tokType, node = startNode();

  // Most types of statements are recognized by the keyword they
  // start with. Many are trivial to parse, some require a bit of
  // complexity.

  switch (starttype) {

    case tokenTypes._break:
      next();
      return finishNode(node, "BreakStatement");

    case tokenTypes._continue:
      next();
      return finishNode(node, "ContinueStatement");

    case tokenTypes._class:
      next();
      return parseClass(node);

    case tokenTypes._def:
      next();
      return parseFunction(node);

    case tokenTypes._for:
      next();
      return parseFor(node);

    case tokenTypes._from: // Skipping from and import statements for now
      skipLine();
      next();
      return parseStatement();

    case tokenTypes._if: case tokenTypes._elif:
    next();
    if (tokType === tokenTypes._parenL) node.test = parseParenExpression();
    else node.test = parseExpression();
    expect(tokenTypes._colon);
    node.consequent = parseSuite();
    if (tokType === tokenTypes._elif) {
      node.alternate = parseStatement();
    }
    else if (eat(tokenTypes._else)) {
      expect(tokenTypes._colon);
      eat(tokenTypes._colon);
      node.alternate = parseSuite();
    }
    else {
      node.alternate = null;
    }
    return finishNode(node, "IfStatement");

    case tokenTypes._import: // Skipping from and import statements for now
      skipLine();
      next();
      return parseStatement();

    case tokenTypes.newline:
      // TODO: parseStatement() should probably eat it's own newline
      next();
      return null;

    case tokenTypes._pass:
      next();
      return finishNode(node, "EmptyStatement");

    case tokenTypes._return:
      if (!inFunction && !options.allowReturnOutsideFunction)
        raise(tokStart, "'return' outside of function");
      next();
      if (tokType === tokenTypes._newline || tokType === tokenTypes._eof) node.argument = null;
      else { node.argument = parseExpression();}
      return finishNode(node, "ReturnStatement");

    case tokenTypes._try: // TODO, and remove parseBlock
      next();
      node.block = parseBlock();
      node.handler = null;
      if (tokType === tokenTypes._catch) {
        var clause = startNode();
        next();
        expect(_parenL);
        clause.param = parseIdent();
        if (strict && isStrictBadIdWord(clause.param.name))
          raise(clause.param.start, "Binding " + clause.param.name + " in strict mode");
        expect(_parenR);
        clause.guard = null;
        clause.body = parseBlock();
        node.handler = finishNode(clause, "CatchClause");
      }
      node.guardedHandlers = empty;
      node.finalizer = eat(_finally) ? parseBlock() : null;
      if (!node.handler && !node.finalizer)
        raise(node.start, "Missing catch or finally clause");
      return finishNode(node, "TryStatement");

    case tokenTypes._while:
      next();
      if (tokType === _parenL) node.test = parseParenExpression();
      else node.test = parseExpression();
      expect(_colon);
      node.body = parseSuite();
      return finishNode(node, "WhileStatement");

    case tokenTypes._with: // TODO
      if (strict) raise(tokStart, "'with' in strict mode");
      next();
      node.object = parseParenExpression();
      node.body = parseStatement();
      return finishNode(node, "WithStatement");

    case tokenTypes._semi:
      next();
      return finishNode(node, "EmptyStatement");

    // Assume it's an ExpressionStatement. If an assign has been
    // converted to a variable declaration, pass it up as is.
    case tokenTypes._documentationString:
      node.leadingComments = parseDocumentationString(token);
      next();
      return finishNode(node, "EmptyStatement");

    default:
      var expr = parseExpression();
      if (tokType !== tokenTypes._semi && tokType !== tokenTypes._newline && tokType !== tokenTypes._eof) unexpected();
      if (expr.type === "VariableDeclaration" || expr.type === "BlockStatement") {
        return expr;
      } else {
        node.expression = expr;
        return finishNode(node, "ExpressionStatement");
      }
  }
}

// Parse indent-enclosed block of statements

function parseBlock() {
  var node = startNode();
  node.body = [];
  while (tokType !== tokenTypes.dedent && tokType !== tokenTypes._eof) {
    var stmt = parseStatement();
    if (stmt) node.body.push(stmt);
  }
  if (tokType === tokenTypes.dedent) next();
  return finishNode(node, "BlockStatement");
}

// Parse 'suite' from Python grammar spec
// Will replace parseBlock eventually

function parseSuite() {
  // NOTE: This is not strictly valid Python for this to be an empty block
  var node = startNode();
  node.body = [];
  if (eat(tokenTypes.newline)) {
    if (tokType === tokenTypes.indent) {
      expect(tokenTypes.indent);
      while (!eat(tokenTypes.dedent) && !eat(tokenTypes.eof)) {
        var stmt = parseStatement();
        if (stmt) node.body.push(stmt);
      }
    }
  } else if (tokType !== tokenTypes.eof) {
    node.body.push(parseStatement());
    next();
  }
  return finishNode(node, "BlockStatement");
}

// Parse for/in loop

function parseFor(node) {
  var init = parseExpression(false, true);
  var tupleArgs = getTupleArgs(init);
  if (!tupleArgs) checkLVal(init);
  expect(_in);
  var right = parseExpression();
  expect(_colon);
  var body = parseSuite();
  finishNode(node, "BlockStatement");
  return nc.createFor(node, init, tupleArgs, right, body);
}

// ### Expression parsing

// These nest, from the most general expression type at the top to
// 'atomic', nondivisible expression types at the bottom. Most of
// the functions will simply let the function(s) below them parse,
// and, *if* the syntactic construct they handle is present, wrap
// the AST node that the inner parser gave them in another node.

// Parse a full expression. The arguments are used to forbid comma
// sequences (in argument lists, array literals, or object literals)
// or the `in` operator (in for loops initalization expressions).

function parseExpression(noComma, noIn) {
  return parseMaybeAssign(noIn);
}

// Used for constructs like `switch` and `if` that insist on
// parentheses around their expression.

function parseParenExpression() {
  expect(_parenL);
  var val = parseExpression();
  expect(_parenR);
  return val;
}

// Parse an assignment expression. This includes applications of
// operators like `+=`.
// Add 'this.' to assignments in a class constructor.
// Convert identifier assignment to variable declaration if the
// identifier doesn't exist in this namespace yet.

function parseMaybeAssign(noIn) {
  var left = parseMaybeTuple(noIn);
  if (tokType.isAssign) {
    var tupleArgs = getTupleArgs(left);
    if (tupleArgs) {
      next();
      var right = parseMaybeTuple(noIn);
      var blockNode = startNodeFrom(left);
      blockNode.body = unpackTuple(tupleArgs, right);
      return finishNode(blockNode, "BlockStatement");
    }

    if (scope.isClass()) {
      var thisExpr = nc.createNodeFrom(left, "ThisExpression");
      left = nc.createNodeFrom(left, "MemberExpression", { object: thisExpr, property: left });
    }

    var node = startNodeFrom(left);
    node.operator = tokVal;
    node.left = left;
    next();
    node.right = parseMaybeTuple(noIn);
    checkLVal(left);

    if (node.operator === '+=' || node.operator === '*=') {
      var right = nc.createNodeSpan(node.right, node.right, "CallExpression");
      right.callee = nc.createNodeOpsCallee(right, node.operator === '+=' ? "add" : "multiply");
      right.arguments = [left, node.right];
      node.right = right;
      node.operator = '=';
    }

    if (left.type === "Identifier" && !scope.exists(left.name)) {
      if (!node.operator || node.operator.length > 1) unexpected();
      scope.addVar(left.name);
      return nc.createVarDeclFromId(node.left, node.left, node.right);
    }
    return finishNode(node, "AssignmentExpression");
  }
  return left;
}

// Parse a tuple

function parseMaybeTuple(noIn) {
  var expr = parseExprOps(noIn);
  if (tokType === _comma) {
    return parseTuple(noIn, expr);
  }
  return expr;
}

// Start the precedence parser.

function parseExprOps(noIn) {
  return parseExprOp(parseMaybeUnary(noIn), -1, noIn);
}

// Parse binary operators with the operator precedence parsing
// algorithm. `left` is the left-hand side of the operator.
// `minPrec` provides context that allows the function to stop and
// defer further parser to one of its callers when it encounters an
// operator that has a lower precedence than the set it is parsing.
// Exponentiation is evaluated right-to-left, so 'prec >= minPrec'
// Exponentiation operator 'x**y' is replaced with 'Math.pow(x, y)'
// Floor division operator 'x//y' is replaced with 'Math.floor(x/y)'
// 'in' and 'not in' implemented via indexOf()

function parseExprOp(left, minPrec, noIn) {
  var node, exprNode, right, op = tokType, val = tokVal;
  var prec = op === _not ? _in.prec : op.prec;
  if (op === _exponentiation && prec >= minPrec) {
    node = startNodeFrom(left);
    next();
    right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
    exprNode = nc.createNodeMemberCall(node, "Math", "pow", [left, right]);
    return parseExprOp(exprNode, minPrec, noIn);
  } else if (prec != null && (!noIn || op !== _in)) {
    if (prec > minPrec) {
      next();
      node = startNodeFrom(left);
      if (op === _floorDiv) {
        right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
        finishNode(node);
        var binExpr = nc.createNodeSpan(node, node, "BinaryExpression", { left: left, operator: '/', right: right });
        exprNode = nc.createNodeMemberCall(node, "Math", "floor", [binExpr]);
      } else if (op === _in || op === _not) {
        if (op === _in || eat(_in)) {
          right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
          finishNode(node);
          var notLit = nc.createNodeSpan(node, node, "Literal", { value: op === _not });
          exprNode = nc.createNodeRuntimeCall(node, 'ops', 'in', [left, right, notLit]);
        } else raise(tokPos, "Expected 'not in' comparison operator");
      } else if (op === _plusMin && val === '+' || op === _multiplyModulo && val === '*') {
        right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
        node.arguments = [left, right];
        finishNode(node, "CallExpression");
        node.callee = nc.createNodeOpsCallee(node, op === _plusMin ? "add" : "multiply");
        exprNode = node;
      } else {
        if (op === _is) {
          if (eat(_not)) node.operator = "!==";
          else node.operator = "===";
        } else node.operator = op.rep != null ? op.rep : val;
        node.left = left;
        node.right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
        exprNode = finishNode(node, (op === _or || op === _and) ? "LogicalExpression" : "BinaryExpression");
      }
      return parseExprOp(exprNode, minPrec, noIn);
    }
  }
  return left;
}

// Parse unary operators.
// '-+' are prefixes here, with different precedence.

function parseMaybeUnary(noIn) {
  if (tokType.prefix || tokType === _plusMin) {
    var prec = tokType === _plusMin ? _posNegNot.prec : tokType.prec;
    var node = startNode();
    node.operator = tokType.rep != null ? tokType.rep : tokVal;
    node.prefix = true;
    tokRegexpAllowed = true;
    next();
    node.argument = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
    return finishNode(node, "UnaryExpression");
  }
  return parseSubscripts(parseExprAtom());
}

// Parse call, dot, and `[]`-subscript expressions.

function parseSubscripts(base, noCalls) {
  var node = startNodeFrom(base);
  if (eat(_dot)) {
    var id = parseIdent(true);
    if (pythonRuntime.imports[base.name] && pythonRuntime.imports[base.name][id.name]) {
      // Calling a Python import function
      // TODO: Unpack parameters into JavaScript-friendly parameters
      var runtimeId = nc.createNodeSpan(base, base, "Identifier", { name: options.runtimeParamName });
      var importsId = nc.createNodeSpan(base, base, "Identifier", { name: "imports" });
      var runtimeMember = nc.createNodeSpan(base, base, "MemberExpression", { object: runtimeId, property: importsId, computed: false });
      node.object = nc.createNodeSpan(base, base, "MemberExpression", { object: runtimeMember, property: base, computed: false });
    } else if (base.name && base.name === scope.getThisReplace()) {
      node.object = nc.createNodeSpan(base, base, "ThisExpression");
    } else node.object = base;
    node.property = id;
    node.computed = false;
    return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
  } else if (eat(_bracketL)) {
    var expr, isSlice = false;
    if (eat(_colon)) isSlice = true;
    else expr = parseExpression();
    if (!isSlice && eat(_colon)) isSlice = true;
    if (isSlice) return parseSlice(node, base, expr, noCalls);
    var subscriptCall = nc.createNodeSpan(expr, expr, "CallExpression");
    subscriptCall.callee = nc.createNodeOpsCallee(expr, "subscriptIndex");
    subscriptCall.arguments = [base, expr];
    node.object = base;
    node.property = subscriptCall;
    node.computed = true;
    expect(_bracketR);
    return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
  } else if (!noCalls && eat(_parenL)) {
    if (scope.isUserFunction(base.name)) {
      // Unpack parameters into JavaScript-friendly parameters, further processed at runtime
      var pl = parseParamsList();

      var args = [];
      var other = [];
      for ( var i = 0; i < pl.length; ++i ) {
        if ( pl[i].isntFormal ) other.push(pl[i]);
        else args.push(pl[i]);
      }

      if ( other.length > 0 ) {
        var createParamsCall = nc.createNodeRuntimeCall(node, 'utils', 'createParamsObj', other);
        args.push(createParamsCall);
      }

      node.arguments = args;
    } else node.arguments = parseExprList(_parenR, false);


    if ( base.name === 'len' && node.arguments.length === 1 ) {
      node.type = "MemberExpression",
        node.object = node.arguments[0];
      node.property = nc.createNodeSpan(base, base, "Identifier", { name: "length"}),
        node.computed = false;
      delete node.arguments;
      delete node.callee;
      finishNode(node, "MemberExpression");
      return node;
    }

    if (scope.isNewObj(base.name)) finishNode(node, "NewExpression");
    else finishNode(node, "CallExpression");

    if (pythonRuntime.functions[base.name]) {
      // Calling a Python built-in function
      // TODO: Unpack parameters into JavaScript-friendly parameters
      if (base.type !== "Identifier") unexpected();
      var runtimeId = nc.createNodeSpan(base, base, "Identifier", { name: options.runtimeParamName });
      var functionsId = nc.createNodeSpan(base, base, "Identifier", { name: "functions" });
      var runtimeMember = nc.createNodeSpan(base, base, "MemberExpression", { object: runtimeId, property: functionsId, computed: false });
      node.callee = nc.createNodeSpan(base, base, "MemberExpression", { object: runtimeMember, property: base, computed: false });
    } else node.callee = base;
    return parseSubscripts(node, noCalls);
  }
  return base;
}

function parseSlice(node, base, start, noCalls) {
  var end, step;
  if (!start) start = nc.createNodeFrom(node, "Literal", { value: null });
  if (tokType === _bracketR || eat(_colon)) {
    end = nc.createNodeFrom(node, "Literal", { value: null });
  } else {
    end = parseExpression();
    if (tokType !== _bracketR) expect(_colon);
  }
  if (tokType === _bracketR) step = nc.createNodeFrom(node, "Literal", { value: null });
  else step = parseExpression();
  expect(_bracketR);

  node.arguments = [start, end, step];
  var sliceId = nc.createNodeFrom(base, "Identifier", { name: "_pySlice" });
  var memberExpr = nc.createNodeSpan(base, base, "MemberExpression", { object: base, property: sliceId, computed: false });
  node.callee = memberExpr;
  return parseSubscripts(finishNode(node, "CallExpression"), noCalls);
}

// Parse an atomic expression - either a single token that is an
// expression, an expression started by a keyword like `function` or
// `new`, or an expression wrapped in punctuation like `()`, `[]`,
// or `{}`.

function parseExprAtom() {
  switch (tokType) {
    case _dict:
      next();
      return parseDict(_parenR);

    case _name:
      return parseIdent();

    case _num: case _string: case _regexp:
    var node = startNode();
    node.value = tokVal;
    node.raw = input.slice(tokStart, tokEnd);
    next();
    return finishNode(node, "Literal");

    case _none: case _true: case _false:
    var node = startNode();
    node.value = tokType.atomValue;
    node.raw = tokType.keyword;
    next();
    return finishNode(node, "Literal");

    case _parenL:
      var tokStartLoc1 = tokStartLoc, tokStart1 = tokStart;
      next();
      if (tokType === _parenR) {
        // Empty tuple
        var node = parseTuple(false);
        eat(_parenR);
        return node;
      }
      var val = parseMaybeTuple(false);
      if (options.locations) {
        val.loc.start = tokStartLoc1;
        val.loc.end = tokEndLoc;
      }
      if (options.ranges)
        val.range = [tokStart1, tokEnd];
      expect(_parenR);
      return val;

    case _bracketL:
      return parseList();

    case _braceL:
      return parseDict(_braceR);
    case _indent:
      raise(tokStart, "Unexpected indent");

    case _else:
      raise(tokPos, '`else` needs to line up with its `if`.');

    default:
      unexpected();
  }
}

// Parse list

// Custom list object is used to simulate native Python list
// E.g. Python '[]' becomes JavaScript 'new __pythonRuntime.objects.list();'
// If list comprehension, build something like this:
//(function() {
//  var _list = [];
//  ...
//  _list.push(expr);
//  return _list;
//}());

function parseList() {
  var node = startNode();
  node.arguments = [];
  next();

  if (!eat(_bracketR)) {
    var expr = parseExprOps(false);
    if (tokType === _for || tokType === _if) {

      // List comprehension
      var tmpVarSuffix = newAstIdCount++;
      expr = nc.createListCompPush(expr, tmpVarSuffix);
      var body = parseCompIter(expr, true);
      finishNode(node);
      return nc.createListCompIife(node, body, tmpVarSuffix);

    } else if (eat(_comma)) {
      node.arguments = [expr].concat(parseExprList(_bracketR, true, false));
    }
    else {
      expect(_bracketR);
      node.arguments = [expr];
    }
  }

  finishNode(node, "NewExpression");
  var runtimeId = nc.createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
  var objectsId = nc.createNodeSpan(node, node, "Identifier", { name: "objects" });
  var runtimeMember = nc.createNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: objectsId, computed: false });
  var listId = nc.createNodeSpan(node, node, "Identifier", { name: "list" });
  node.callee = nc.createNodeSpan(node, node, "MemberExpression", { object: runtimeMember, property: listId, computed: false });
  return node;
}

// Parse a comp_iter from Python language grammar
// Used to build list comprehensions
// 'expr' is the body to be used after unrolling the ifs and fors

function parseCompIter(expr, first) {
  if (first && tokType !== _for) unexpected();
  if (eat(_bracketR)) return expr;
  var node = startNode();
  if (eat(_for)) {
    var init = parseExpression(false, true);
    var tupleArgs = getTupleArgs(init);
    if (!tupleArgs) checkLVal(init);
    expect(_in);
    var right = parseExpression();
    var body = parseCompIter(expr, false);
    var block = nc.createNodeSpan(body, body, "BlockStatement", { body: [body] });
    finishNode(node, "BlockStatement");
    return nc.createFor(node, init, tupleArgs, right, block);
  } else if (eat(_if)) {
    if (tokType === _parenL) node.test = parseParenExpression();
    else node.test = parseExpression();
    node.consequent = parseCompIter(expr, false);
    return finishNode(node, "IfStatement");
  } else unexpected();
}

// Parse class

function parseClass(ctorNode) {
  // Container for class constructor and prototype functions
  var container = startNodeFrom(ctorNode);
  container.body = ctorNode;

  // Parse class signature
  container.id = parseIdent();
  ctorNode.params = [];
  ctorNode.body = [];
  var classParams = [];
  if (eat(_parenL)) {
    var first = true;
    while (!eat(_parenR)) {
      if (!first) expect(_comma); else first = false;
      classParams.push(parseIdent());
    }
  }
  if (classParams.length > 1) raise(tokPos, "Multiple inheritance not supported");
  expect(_colon);

  // Start new namespace for class body
  scope.startClass(container.id.name);

  // Save a reference for source ranges
  var classBodyRefNode = finishNode(startNode());

  // Parse class body
  var classBlock = parseSuite();

  // Generate additional AST to implement class
  var classStmt = nc.createClass(container, ctorNode, classParams, classBodyRefNode, classBlock);

  scope.end();

  return classStmt;
}

// Parse dictionary
// Custom dict object used to simulate native Python dict
// E.g. "{'k1':'v1', 'k2':'v2'}" becomes "new __pythonRuntime.objects.dict(['k1', 'v1'], ['k2', 'v2']);"

function parseDict(tokClose) {
  var node = startNode(), first = true, key, value;
  node.arguments = [];
  next();
  while (!eat(tokClose)) {
    if (!first) {
      expect(_comma);
    } else first = false;

    if (tokClose === _braceR) {
      key = parsePropertyName();
      expect(_colon);
      value = parseExprOps(false);
    } else if (tokClose === _parenR) {
      var keyId = parseIdent(true);
      key = startNodeFrom(keyId);
      key.value = keyId.name;
      finishNode(key, "Literal");
      expect(_eq);
      value = parseExprOps(false);
    } else unexpected();
    node.arguments.push(nc.createNodeSpan(key, value, "ArrayExpression", { elements: [key, value] }));
  }
  finishNode(node, "NewExpression");

  var runtimeId = nc.createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
  var objectsId = nc.createNodeSpan(node, node, "Identifier", { name: "objects" });
  var runtimeMember = nc.createNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: objectsId, computed: false });
  var listId = nc.createNodeSpan(node, node, "Identifier", { name: "dict" });
  node.callee = nc.createNodeSpan(node, node, "MemberExpression", { object: runtimeMember, property: listId, computed: false });

  return node;
}

function parsePropertyName() {
  if (tokType === _num || tokType === _string) return parseExprAtom();
  return parseIdent(true);
}

function parseFunction(node) {
  // TODO: The node creation utilities used here are tightly coupled (e.g. variable names)

  var suffix = newAstIdCount++;
  node.id = parseIdent();
  node.params = [];

  // Parse parameters

  var formals = [];     // In order, maybe with default value
  var argsId = null;    // *args
  var kwargsId = null;  // **kwargs
  var defaultsFound = false;
  var first = true;

  scope.startFn(node.id.name);

  expect(_parenL);
  while (!eat(_parenR)) {
    if (!first) expect(_comma); else first = false;
    if (tokVal === '*') {
      if (kwargsId) raise(tokPos, "invalid syntax");
      next(); argsId = parseIdent();
    } else if (tokVal === '**') {
      next(); kwargsId = parseIdent();
    } else {
      if (kwargsId) raise(tokPos, "invalid syntax");
      var paramId = parseIdent();
      if (eat(_eq)) {
        formals.push({ id: paramId, expr: parseExprOps(false) });
        defaultsFound = true;
      } else {
        if (defaultsFound) raise(tokPos, "non-default argument follows default argument");
        if (argsId) raise(tokPos, "missing required keyword-only argument");
        formals.push({ id: paramId, expr: null });
      }
      scope.addVar(paramId.name);
    }
  }
  expect(_colon);

  // Start a new scope with regard to the `inFunction`
  // flag (restore them to their old value afterwards).
  // `inFunction` used to throw syntax error for stray `return`
  var oldInFunc = inFunction = true;

  // If class method, remove class instance var from params and save for 'this' replacement
  if (scope.isParentClass()) {
    var selfId = formals.shift();
    scope.setThisReplace(selfId.id.name);
  }

  var body = parseSuite();
  node.body = nc.createNodeSpan(body, body, "BlockStatement", { body: [] });

  // Add runtime parameter processing
  // The caller may pass a complex parameter object as a single parameter like this:
  // {formals:[<expr>, <expr>, ...], keywords:{<id>:<expr>, <id>:<expr>, ...}}

  var r = node.id;
  var __hasParams = nc.createNodeSpan(r, r, "Identifier", { name: '__hasParams' + suffix });
  var __params = nc.createNodeSpan(node.id, node.id, "Identifier", { name: '__params' + suffix });
  var __realArgCount = nc.createNodeSpan(node.id, node.id, "Identifier", { name: '__realArgCount' + suffix });
  var paramHandler = [];

  if (formals.length > 0 || argsId || kwargsId) {
    var argumentsLen = nc.createNodeSpan(r, r, "BinaryExpression", {
      operator: '-',
      left: nc.createNodeMembIds(r, 'arguments', 'length'),
      right: nc.createNodeSpan(r, r, "Literal", { value: 1 })
    });

    var argumentsN = nc.createNodeSpan(r, r, "MemberExpression", {
      computed: true, object: nc.createNodeSpan(r, r, "Identifier", { name: 'arguments' }),
      property: argumentsLen
    });

    // var __hasParams = arguments.length === 1 && arguments[arguments.length-1].formals && arguments[arguments.length-1].keywords;
    var setHasParams = nc.createNodeSpan(r, r, "LogicalExpression", {
      operator: '&&',
      left: nc.createNodeSpan(r, r, "LogicalExpression", {
        operator: '&&',
        left: nc.createNodeSpan(r, r, "BinaryExpression", {
          operator: '>',
          left: nc.createNodeMembIds(r, 'arguments', 'length'),
          right: nc.createNodeSpan(r, r, "Literal", { value: 0 })
        }),
        right: argumentsN
      }),
      right: nc.createNodeSpan(r, r, "MemberExpression", {
        computed: false, object: argumentsN,
        property: nc.createNodeSpan(r, r, "Identifier", { name: 'keywords' }),
      })
    });

    node.body.body.push(nc.createGeneratedVarDeclFromId(r, __hasParams, setHasParams));

    //var __params = __hasParams ? arguments[arguments.length - 1].keywords : {};
    var setParams = nc.createNodeSpan(r, r, "ConditionalExpression", {
      test: __hasParams,
      consequent: nc.createNodeSpan(r, r, "MemberExpression", {
        computed: false, object: argumentsN,
        property: nc.createNodeSpan(r, r, "Identifier", { name: 'keywords' }),
      }),
      alternate: nc.createNodeSpan(r, r, "ObjectExpression", { properties: [] })
    });
    paramHandler.push(nc.createGeneratedVarDeclFromId(r, __params, setParams));

    // var __realArgCount = arguments.length - __params0 ? 0 : 1;
    var setRealArgCount = (nc.createGeneratedVarDeclFromId(node.id,
      __realArgCount,
      nc.createNodeSpan(node.id, node.id, "BinaryExpression", {
        operator: '-',
        left: nc.createNodeMembIds(node.id, 'arguments', 'length'),
        //right: nc.createNodeSpan(node.id, node.id, "Literal", { value: 0 })
        right: nc.createNodeSpan(node.id, node.id, "ConditionalExpression", {
          test: __hasParams,
          consequent: nc.createNodeSpan(node.id, node.id, "Literal", { value: 1 }),
          alternate: nc.createNodeSpan(node.id, node.id, "Literal", { value: 0 })
        })
      })
    ));

    paramHandler.push(setRealArgCount);
  }

  // Verify that argument names are not repeated
  for (var i = 0; i < formals.length; ++i) {
    node.params.push(formals[i].id);
    for (var j = 0; j < i; ++j) if (formals[i].id.name === formals[j].id.name)
      raise(formals[i].id.start, "Argument name clash");
  }
  var fastModePossible = true;

  for ( i = 0; i < formals.length; ++i) {
    if ( formals[i].expr ) fastModePossible = false;
    var argName = nc.createNodeSpan(node.id, node.id, "Identifier", { name: formals[i].id.name });
    var argNameStr = nc.createNodeSpan(node.id, node.id, "Literal", { value: formals[i].id.name });
    var argSet = nc.createNodeSpan(node.id, node.id, "AssignmentExpression", {
      operator: '=',
      left: argName,
      right: nc.createNodeSpan(node.id, node.id, "ConditionalExpression", {
        test: nc.createNodeSpan(node.id, node.id, "BinaryExpression", { operator: 'in', left: argNameStr, right: __params }),
        consequent: nc.createNodeSpan(node, node, "MemberExpression", { object: __params, property: argNameStr, computed: true }),
        alternate: formals[i].expr ? formals[i].expr : nc.createNodeSpan(node.id, node.id, "Identifier", { name: 'undefined' })
      })
    });

    var argCheck = nc.createNodeSpan(node.id, node.id, "IfStatement", {
      test: nc.createNodeSpan(node.id, node.id, "BinaryExpression", {
        operator: '<',
        left: __realArgCount,
        right:  nc.createNodeSpan(node.id, node.id, "Literal", { value: i+1 })
      }),
      consequent: nc.createNodeSpan(node.id, node.id, "ExpressionStatement", { expression: argSet })
    });

    paramHandler.push(argCheck);
  }

  if ( paramHandler.length  > 0 ) {
    if ( fastModePossible ) {
      node.body.body.push(nc.createNodeSpan(node.id, node.id, "IfStatement", {
        test: __hasParams,
        consequent: nc.createNodeSpan(node.id, node.id, "BlockStatement", {body: paramHandler})
      }));
    } else {
      Array.prototype.push.apply(node.body.body, paramHandler);
    }
  }

  if (argsId) {
    // var __formalsIndex = n;
    node.body.body.push(nc.createGeneratedVarDeclFromId(node.id,
      nc.createNodeSpan(node.id, node.id, "Identifier", { name: '__formalsIndex' + suffix }),
      nc.createNodeSpan(node.id, node.id, "Literal", { value: formals.length })));

    // var <args> = [];
    var argsAssign = nc.createGeneratedVarDeclFromId(argsId, argsId, nc.createNodeSpan(argsId, argsId, "ArrayExpression", { elements: [] }));
    node.body.body.push(argsAssign);
    node.body.body.push(nc.createNodeArgsWhileConsequent(argsId, suffix));

  }

  if (kwargsId) {
    for (var i = 0; i < formals.length; ++i) {
      var formalDelete = nc.createNodeSpan(kwargsId, kwargsId, "ExpressionStatement", {
        expression: nc.createNodeSpan(kwargsId, kwargsId, "UnaryExpression", {
          operator: 'delete',
          prefix: true,
          argument: nc.createNodeSpan(kwargsId, kwargsId, "MemberExpression", {
            object: __params,
            property: nc.createNodeSpan(node.id, node.id, "Identifier", { name: formals[i].id.name }),
            computed: false
          })
        })
      });
      node.body.body.push(formalDelete);
    }

    // var <kwargs> = {};
    var kwargsAssign = nc.createGeneratedVarDeclFromId(kwargsId, kwargsId, __params);
    node.body.body.push(kwargsAssign);
  }

  // Convert original body to 'return (function() {<body>}).call(this);';
  //node.body.body.push(nc.createNodeFnBodyIife(body));

  //Append real body to node
  node.body.body.push.apply(node.body.body, body.body);

  inFunction = oldInFunc;


  // If class method, replace with prototype function literals
  var retNode;
  if (scope.isParentClass()) {
    finishNode(node);
    var classId = nc.createNodeSpan(node, node, "Identifier", { name: scope.getParentClassName() });
    var prototypeId = nc.createNodeSpan(node, node, "Identifier", { name: "prototype" });
    var functionId = node.id;
    var prototypeMember = nc.createNodeSpan(node, node, "MemberExpression", { property: prototypeId, computed: false });
    var functionMember = nc.createNodeSpan(node, node, "MemberExpression", { object: prototypeMember, property: functionId, computed: false });
    var functionExpr = nc.createNodeSpan(node, node, "FunctionExpression", { body: node.body, params: node.params });
    var assignExpr = nc.createNodeSpan(node, node, "AssignmentExpression", { left: functionMember, operator: "=", right: functionExpr });
    retNode = nc.createNodeSpan(node, node, "ExpressionStatement", { expression: assignExpr });
  } else {
    retNode = finishNode(node, "FunctionDeclaration");
  }

  scope.end();

  return retNode;
}

// Parses a comma-separated list of expressions, and returns them as
// an array. `close` is the token type that ends the list, and
// `allowEmpty` can be turned on to allow subsequent commas with
// nothing in between them to be parsed as `null` (which is needed
// for array literals).

function parseExprList(close, allowTrailingComma, allowEmpty) {
  var elts = [], first = true;
  while (!eat(close)) {
    if (!first) {
      expect(_comma);
      if (allowTrailingComma && options.allowTrailingCommas && eat(close)) break;
    } else first = false;

    if (allowEmpty && tokType === _comma) elts.push(null);
    else elts.push(parseExprOps(false));
  }
  return elts;
}

function parseParamsList() {
  // In: expr, expr, ..., id=expr, id=expr, ...
  // Out: expr, expr, ..., {id:expr, __kwp:true}, {id:expr, __kwp:true}, ...
  var elts = [], first = true;
  while (!eat(_parenR)) {
    if (!first) expect(_comma);
    else first = false;
    var expr = parseExprOps(false);
    if (eat(_eq)) {
      var right = parseExprOps(false);
      var kwId = nc.createNodeSpan(expr, right, "Identifier", {name:"__kwp"});
      var kwLit = nc.createNodeSpan(expr, right, "Literal", {value:true});
      var left = nc.createNodeSpan(expr, right, "ObjectExpression", { properties: [] });
      left.isntFormal = true;
      left.properties.push({ type: "Property", key: expr, value: right, kind: "init" });
      left.properties.push({ type: "Property", key: kwId, value: kwLit, kind: "init" });
      expr = left;
    }
    elts.push(expr);
  }
  return elts;
}

// Parse the next token as an identifier. If `liberal` is true (used
// when parsing properties), it will also convert keywords into
// identifiers.

// TODO: liberal?

function parseIdent(liberal) {
  var node = startNode();
  if (liberal) liberal = false;
  if (tokType === _name) {
    if (!liberal && strict && input.slice(tokStart, tokEnd).indexOf("\\") == -1)
      raise(tokStart, "The keyword '" + tokVal + "' is reserved");
    node.name = tokVal;
  } else if (liberal && tokType.keyword) {
    node.name = tokType.keyword;
  } else {
    unexpected();
  }
  tokRegexpAllowed = false;
  next();
  return finishNode(node, "Identifier");
}

function parseTuple(noIn, expr) {
  var node = expr ? startNodeFrom(expr) : startNode();
  node.arguments = expr ? [expr] : [];

  // Tuple with single element has special trailing comma: t = 'hi',
  // Look ahead and eat comma in this scenario
  if (tokType === _comma) {
    var oldPos = tokPos; skipSpace();
    var newPos = tokPos; tokPos = oldPos;
    if (newPos >= inputLen || input[newPos] === ';' || input[newPos] === ')' || newline.test(input[newPos]))
      eat(_comma);
  }

  while (eat(_comma)) {
    node.arguments.push(parseExprOps(noIn));
  }
  finishNode(node, "NewExpression");

  var runtimeId = nc.createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
  var objectsId = nc.createNodeSpan(node, node, "Identifier", { name: "objects" });
  var runtimeMember = nc.createNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: objectsId, computed: false });
  var listId = nc.createNodeSpan(node, node, "Identifier", { name: "tuple" });
  node.callee = nc.createNodeSpan(node, node, "MemberExpression", { object: runtimeMember, property: listId, computed: false });

  return node;
}

function parseDocumentationString(token) {
  var node = startNode();
  node.value = token.value;
  return finishNode(node, "Block");
}

function parseImport(node) {
  var variableDeclaration = startNode();
  var variableDeclarator = startNode();
  var callExpression = startNode();
  var identifier = startNode();
  var literal = startNode();

  //variableDeclaration.
  finishNode(variableDeclarator, "VariableDeclarator");
  finishNode(variableDeclaration, "VariableDeclaration");
  return variableDeclaration;
}
