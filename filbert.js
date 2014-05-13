// Filbert is a Python parser written in JavaScript.
//
// Filbert was written by Matt Lott and released under an MIT
// license. It was adatped from [Acorn](https://github.com/marijnh/acorn.git)
// by Marijn Haverbeke.
//
// Git repository for Filbert are available at
//
//     https://github.com/differentmatt/filbert.git
//
// Please use the [github bug tracker][ghbt] to report issues.
//
// [ghbt]: https://github.com/differentmatt/filbert/issues

(function(root, mod) {
  if (typeof exports == "object" && typeof module == "object") return mod(exports); // CommonJS
  if (typeof define == "function" && define.amd) return define(["exports"], mod); // AMD
  mod(root.filbert || (root.filbert = {})); // Plain browser env
})(this, function(exports) {
  "use strict";

  exports.version = "0.5.1";

  // The main exported interface (under `self.filbert` when in the
  // browser) is a `parse` function that takes a code string and
  // returns an abstract syntax tree as specified by [Mozilla parser
  // API][api].
  //
  // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

  var options, input, inputLen, sourceFile;

  exports.parse = function(inpt, opts) {
    input = String(inpt); inputLen = input.length;
    setOptions(opts);
    initTokenState();
    return parseTopLevel(options.program);
  };

  // A second optional argument can be given to further configure
  // the parser process. These options are recognized:

  var defaultOptions = exports.defaultOptions = {
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
    // parser from the callback—that will corrupt its internal state.
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

  function setOptions(opts) {
    options = opts || {};
    for (var opt in defaultOptions) if (!Object.prototype.hasOwnProperty.call(options, opt))
      options[opt] = defaultOptions[opt];
    sourceFile = options.sourceFile || null;
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

  // Filbert is organized as a tokenizer and a recursive-descent parser.
  // The `tokenize` export provides an interface to the tokenizer.
  // Because the tokenizer is optimized for being efficiently used by
  // the Filbert parser itself, this interface is somewhat crude and not
  // very modular. Performing another parse or call to `tokenize` will
  // reset the internal state, and invalidate existing tokenizers.

  exports.tokenize = function(inpt, opts) {
    input = String(inpt); inputLen = input.length;
    setOptions(opts);
    initTokenState();

    var t = {};
    function getToken(forceRegexp) {
      lastEnd = tokEnd;
      readToken(forceRegexp);
      t.start = tokStart; t.end = tokEnd;
      t.startLoc = tokStartLoc; t.endLoc = tokEndLoc;
      t.type = tokType; t.value = tokVal;
      return t;
    }
    getToken.jumpTo = function(pos, reAllowed) {
      tokPos = pos;
      if (options.locations) {
        tokCurLine = 1;
        tokLineStart = lineBreak.lastIndex = 0;
        var match;
        while ((match = lineBreak.exec(input)) && match.index < pos) {
          ++tokCurLine;
          tokLineStart = match.index + match[0].length;
        }
      }
      tokRegexpAllowed = reAllowed;
      skipSpace();
    };
    return getToken;
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
  // `return` statements outside of functions, `labels` to verify that
  // `break` and `continue` have somewhere to jump to, and `strict`
  // indicates whether strict mode is on.

  var inFunction, labels, strict;

  // This function is used to raise exceptions on parse errors. It
  // takes an offset integer (into the current `input`) to indicate
  // the location of the error, attaches the position to the end
  // of the error message, and then raises a `SyntaxError` with that
  // message.

  function raise(pos, message) {
    var loc = getLineInfo(input, pos);
    message += " (" + loc.line + ":" + loc.column + ")";
    var err = new SyntaxError(message);
    err.pos = pos; err.loc = loc; err.raisedAt = tokPos;
    throw err;
  }

  // Reused empty array added for node fields that are always empty.

  var empty = [];

  // Current indentation stack

  var tokCurIndent = [];
  
  // Number of dedent tokens left (i.e. if tokType == _dedent, tokCurDedent > 0)
  // Multiple dedent tokens are read in at once, but processed individually in next()

  var tokCurDedent;

  // Used for name collision avoidance whend adding extra AST identifiers

  var newAstIdCount = 0;

  // ## Scope

  // Collection of namespaces saved as a stack
  // A namespace is a mapping of identifiers to 3 types: variables, functions, classes
  // A namespace also knows whether it is for global, class, or function
  // A new namespace is pushed at function and class start, and popped at their end
  // Starts with a global namespace on the stack
  // E.g. scope.namespaces ~ [{type: 'g', map:{x: 'v', MyClass: 'c'} }, ...]

  // TODO: Not tracking built-in namespace
  
  var scope = {
    namespaces: [],
    init: function () { this.namespaces = [{ type: 'g', map: {} }]; },
    current: function(offset) { 
      offset = offset || 0;
      return this.namespaces[this.namespaces.length - offset - 1];
    },
    startClass: function (id) {
      this.current().map[id] = 'c';
      this.namespaces.push({ type: 'c', map: {}, className: id });
    },
    startFn: function (id) {
      this.current().map[id] = 'f';
      this.namespaces.push({ type: 'f', map: {}, fnName: id });
    },
    end: function () { this.namespaces.pop(); },
    addVar: function (id) { this.current().map[id] = 'v'; },
    exists: function (id) { return this.current().map.hasOwnProperty(id); },
    isClass: function () { return this.current().type === 'c'; },
    isParentClass: function() { return this.current(1).type === 'c'; },
    isNewObj: function (id) {
      for (var i = this.namespaces.length - 1; i >= 0; i--)
        if (this.namespaces[i].map[id] === 'c') return true;
        else if (this.namespaces[i].map[id] === 'f') break;
      return false;
    },
    getParentClassName: function () { return this.current(1).className; },
    getThisReplace: function () { return this.current().thisReplace; },
    setThisReplace: function (s) { this.current().thisReplace = s; }
  };
  

  // ## Token types

  // The assignment of fine-grained, information-carrying type objects
  // allows the tokenizer to store the information it has about a
  // token in a way that is very cheap for the parser to look up.

  // All token type variables start with an underscore, to make them
  // easy to recognize.

  // These are the general types. The `type` property is only used to
  // make them recognizeable when debugging.

  var _num = {type: "num"}, _regexp = {type: "regexp"}, _string = {type: "string"};
  var _name = {type: "name"}, _eof = {type: "eof"};
  var _newline = {type: "newline"}, _indent = {type: "indent"}, _dedent = {type: "dedent"};

  // Keyword tokens. The `keyword` property (also used in keyword-like
  // operators) indicates that the token originated from an
  // identifier-like word, which is used when parsing property names.
  //
  // The `beforeExpr` property is used to disambiguate between regular
  // expressions and divisions. It is set on all token types that can
  // be followed by an expression (thus, a slash after them would be a
  // regular expression).
  
  var _dict = { keyword: "dict" };  // TODO: not a keyword
  var _as = { keyword: "as" }, _assert = { keyword: "assert" }, _break = { keyword: "break" };
  var _class = { keyword: "class" }, _continue = { keyword: "continue" };
  var _def = { keyword: "def" }, _del = { keyword: "del" };
  var _elif = { keyword: "elif", beforeExpr: true }, _else = { keyword: "else", beforeExpr: true };
  var _except = { keyword: "except", beforeExpr: true }, _finally = {keyword: "finally"};
  var _for = { keyword: "for" }, _from = { keyword: "from" }, _global = { keyword: "global" };
  var _if = { keyword: "if" }, _import = { keyword: "import" };
  var _lambda = {keyword: "lambda"}, _nonlocal = {keyword: "nonlocal"};
  var _pass = { keyword: "pass" }, _raise = {keyword: "raise"};
  var _return = { keyword: "return", beforeExpr: true }, _try = { keyword: "try" }
  var _while = {keyword: "while"}, _with = {keyword: "with"}, _yield = {keyword: "yield"};

  // The keywords that denote values.

  var _none = {keyword: "None", atomValue: null}, _true = {keyword: "True", atomValue: true};
  var _false = {keyword: "False", atomValue: false};

  // Some keywords are treated as regular operators. `in` sometimes
  // (when parsing `for`) needs to be tested against specifically, so
  // we assign a variable name to it for quick comparing.
  // 'prec' is the operator precedence'

  var _logicalOR = { keyword: "or", prec: 1, beforeExpr: true, rep: "||" }
  var _logicalAND = { keyword: "and", prec: 2, beforeExpr: true, rep: "&&" }
  var _logicalNOT = { keyword: "not", prec: 3, prefix: true, beforeExpr: true, rep: "!" };
  var _in = { keyword: "in", prec: 4, beforeExpr: true };
  var _is = { keyword: "is", prec: 4, beforeExpr: true };

  // Map keyword names to token types.

  var keywordTypes = {
    "dict": _dict,
    "False": _false, "None": _none, "True": _true, "and": _logicalAND, "as": _as, 
    "break": _break, "class": _class, "continue": _continue, "def": _def, "del": _del,
    "elif": _elif, "else": _else, "except": _except, "finally": _finally, "for": _for,
    "from": _from, "global": _global, "if": _if, "import": _import, "in": _in, "is": _is, 
    "lambda": _lambda, "nonlocal": _nonlocal, "not": _logicalNOT, "or": _logicalOR, 
    "pass": _pass, "raise": _raise, "return": _return, "try": _try, "while": _while, 
    "with": _with, "yield": _yield
  };

  // Punctuation token types. Again, the `type` property is purely for debugging.

  var _bracketL = {type: "[", beforeExpr: true}, _bracketR = {type: "]"}, _braceL = {type: "{", beforeExpr: true};
  var _braceR = {type: "}"}, _parenL = {type: "(", beforeExpr: true}, _parenR = {type: ")"};
  var _comma = {type: ",", beforeExpr: true}, _semi = {type: ";", beforeExpr: true};
  var _colon = { type: ":", beforeExpr: true }, _dot = { type: "." }, _question = { type: "?", beforeExpr: true };
  
  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `prec` specifies the precedence of this operator.
  //
  // `prefix` marks the operator as a prefix unary operator. 
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  var _slash = { prec: 10, beforeExpr: true }, _eq = { isAssign: true, beforeExpr: true };
  var _assign = {isAssign: true, beforeExpr: true};
  var _equality = { prec: 4, beforeExpr: true };
  var _relational = {prec: 4, beforeExpr: true };
  var _bitwiseOR = { prec: 5, beforeExpr: true };
  var _bitwiseXOR = { prec: 6, beforeExpr: true };
  var _bitwiseAND = { prec: 7, beforeExpr: true };
  var _bitShift = { prec: 8, beforeExpr: true };
  var _plusMin = { prec: 9, beforeExpr: true };
  var _multiplyModulo = { prec: 10, beforeExpr: true };
  var _floorDiv = { prec: 10, beforeExpr: true };
  var _posNegNot = { prec: 11, prefix: true, beforeExpr: true };
  var _bitwiseNOT = { prec: 11, prefix: true, beforeExpr: true };
  var _exponentiation = { prec: 12, beforeExpr: true };

  // Provide access to the token types for external users of the
  // tokenizer.

  exports.tokTypes = {bracketL: _bracketL, bracketR: _bracketR, braceL: _braceL, braceR: _braceR,
                      parenL: _parenL, parenR: _parenR, comma: _comma, semi: _semi, colon: _colon,
                      dot: _dot, question: _question, slash: _slash, eq: _eq, name: _name, eof: _eof,
                      num: _num, regexp: _regexp, string: _string};
  for (var kw in keywordTypes) exports.tokTypes["_" + kw] = keywordTypes[kw];

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

  // ## Tokenizer

  // These are used when `options.locations` is on, for the
  // `tokStartLoc` and `tokEndLoc` properties.

  function Position() {
    this.line = tokCurLine;
    this.column = tokPos - tokLineStart;
  }

  // Reset the token state. Used at the start of a parse.

  function initTokenState() {
    tokCurLine = 1;
    tokPos = tokLineStart = 0;
    tokRegexpAllowed = true;
    tokCurIndent = [];
    newAstIdCount = 0;
    scope.init();
  }

  // Called at the end of every token. Sets `tokEnd`, `tokVal`, and
  // `tokRegexpAllowed`, and skips the space after the token, so that
  // the next one's `tokStart` will point at the right position.

  function finishToken(type, val) {
    tokEnd = tokPos;
    if (options.locations) tokEndLoc = new Position;
    tokType = type;
    if (type !== _newline) skipSpace();
    tokVal = val;
    tokRegexpAllowed = type.beforeExpr;
  }

  function skipLine() {
    var ch = input.charCodeAt(++tokPos);
    while (tokPos < inputLen && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
      ++tokPos;
      ch = input.charCodeAt(tokPos);
    }
  }

  function skipLineComment() {
    var start = tokPos;
    var startLoc = options.onComment && options.locations && new Position;
    skipLine();
    if (options.onComment)
      options.onComment(input.slice(start + 1, tokPos), start, tokPos,
                        startLoc, options.locations && new Position);
  }

  // Called at the start of the parse and after every token. Skips
  // whitespace and comments, and.

  function skipSpace() {
    while (tokPos < inputLen) {
      var ch = input.charCodeAt(tokPos);
      if (ch === 32) { // ' '
        ++tokPos;
      } else if (ch === 9 || ch === 11 || ch === 12) {
        ++tokPos;
      } else if (ch === 35) { // '#'
        skipLineComment();
      } else if (ch === 160) { // '\xa0'
        ++tokPos;
      } else if (ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
        ++tokPos;
      } else {
        break;
      }
    }
  }

  // ### Token reading

  // This is the function that is called to fetch the next token. It
  // is somewhat obscure, because it works in character codes rather
  // than characters, and because operator parsing has been inlined
  // into it.
  //
  // All in the name of speed.
  //
  // The `forceRegexp` parameter is used in the one case where the
  // `tokRegexpAllowed` trick does not work. See `parseStatement`.

  function readToken_dot() {
    var next = input.charCodeAt(tokPos + 1);
    if (next >= 48 && next <= 57) return readNumber(true);
    ++tokPos;
    return finishToken(_dot);
  }

  function readToken_slash() { // '/'
    if (tokRegexpAllowed) { ++tokPos; return readRegexp(); }
    var next = input.charCodeAt(tokPos + 1);
    if (next === 47) return finishOp(_floorDiv, 2);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_slash, 1);
  }

  function readToken_mult_modulo(code) { // '*%'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 42 && next === code) return finishOp(_exponentiation, 2);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_multiplyModulo, 1);
  }
  
  function readToken_pipe_amp(code) { // '|&'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(code === 124 ? _bitwiseOR : _bitwiseAND, 1);
  }

  function readToken_caret() { // '^'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_bitwiseXOR, 1);
  }

  function readToken_plus_min(code) { // '+-'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_plusMin, 1);
  }

  function readToken_lt_gt(code) { // '<>'
    var next = input.charCodeAt(tokPos + 1);
    var size = 1;
    if (next === code) {
      size = 2;
      if (input.charCodeAt(tokPos + size) === 61) return finishOp(_assign, size + 1);
      return finishOp(_bitShift, size);
    }
    if (next === 61) size = 2;
    return finishOp(_relational, size);
  }

  function readToken_eq_excl(code) { // '=!'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_equality, 2);
    return finishOp(_eq, 1);
  }

  // Parse an indent
  // Possible output tokens: _indent, _dedent, _eof
  // TODO: assumes no \r\n for now, hence positions all moved by 1 spot
  // TODO: skip all whitespace characters, not just ' ' and '\t'
  // TODO: disallow unequal indents of same length (e.g. nested if/else block)
  // TODO: some weird handling of tokPos because of finishOp size logic

  function readToken_indent() {
    // Read indent, skip empty lines and comments
    var indent = "";
    var indentPos = tokPos;
    while (indentPos < inputLen) {
      var ch = input.charCodeAt(indentPos);
      if (ch === 32 || ch === 9) { // ' ' or '\t'
        indent += String.fromCharCode(ch);
        ++indentPos;
      } else if (ch === 10) { // '\n'
        indent = "";
        tokPos = indentPos;
        ++indentPos;
        if (options.locations) {
          tokLineStart = indentPos;
          ++tokCurLine;
        }
      } else if (ch === 35) { // '#'
        do {
          var next = input.charCodeAt(++indentPos);
        } while (indentPos < inputLen && next !== 10);
        // TODO: call onComment
      } else {
        break;
      }
    }

    // Determine token type based on indent found versus indentation history
    var type;
    if (indent.length > 0) {
      if (tokCurIndent.length === 0 || indent.length > tokCurIndent[tokCurIndent.length - 1].length) {
        type = _indent;
        tokCurIndent.push(indent);
      } else if (tokCurIndent.length > 0 && indent.length < tokCurIndent[tokCurIndent.length - 1].length) {
        type = _dedent;
        tokCurDedent = 0;
        for (var i = tokCurIndent.length - 1; i >= 0 && indent.length < tokCurIndent[i].length; --i)
            ++tokCurDedent;
      } else {
        tokPos += indent.length;
      }
    } else if (indentPos >= inputLen) {
      type = _eof;
    } else if (tokCurIndent.length > 0) {
      type = _dedent;
      tokCurDedent = tokCurIndent.length;
    }

    switch (type) {
      case _indent: case _dedent: return finishOp(type, indentPos - ++tokPos);
      case _eof:
        tokPos = inputLen;
        if (options.locations) tokStartLoc = new Position;
        return finishOp(type, 0);
      default:
        tokType = null;
        return readToken();
    }
  }

  function getTokenFromCode(code) {
    switch(code) {

    case 10: // '\n'
      // TODO: other unicode newline characters
      ++tokPos;
      if (options.locations) {
        ++tokCurLine;
        tokLineStart = tokPos;
      }
      return finishToken(_newline);

    case 35: // '#'
      skipLineComment();
      return readToken();

      // The interpretation of a dot depends on whether it is followed
      // by a digit.
    case 46: // '.'
      return readToken_dot();

      // Punctuation tokens.
    case 40: ++tokPos; return finishToken(_parenL);
    case 41: ++tokPos; return finishToken(_parenR);
    case 59: ++tokPos; return finishToken(_semi);
    case 44: ++tokPos; return finishToken(_comma);
    case 91: ++tokPos; return finishToken(_bracketL);
    case 93: ++tokPos; return finishToken(_bracketR);
    case 123: ++tokPos; return finishToken(_braceL);
    case 125: ++tokPos; return finishToken(_braceR);
    case 58: ++tokPos; return finishToken(_colon);
    case 63: ++tokPos; return finishToken(_question);

      // '0x' is a hexadecimal number.
    case 48: // '0'
      var next = input.charCodeAt(tokPos + 1);
      if (next === 120 || next === 88) return readHexNumber();
      // Anything else beginning with a digit is an integer, octal
      // number, or float.
    case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
      return readNumber(false);

      // Quotes produce strings.
    case 34: case 39: // '"', "'"
      return readString(code);

    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.

    case 47: // '/'
      return readToken_slash(code);

    case 42: case 37: // '*%'
      return readToken_mult_modulo(code);

    case 124: case 38: // '|&'
      return readToken_pipe_amp(code);

    case 94: // '^'
      return readToken_caret();

    case 43: case 45: // '+-'
      return readToken_plus_min(code);

    case 60: case 62: // '<>'
      return readToken_lt_gt(code);

    case 61: case 33: // '=!'
      return readToken_eq_excl(code);

    case 126: // '~'
      return finishOp(_bitwiseNOT, 1);
    }

    return false;
  }

  function readToken(forceRegexp) {
    if (!forceRegexp) tokStart = tokPos;
    else tokPos = tokStart + 1;
    if (options.locations) tokStartLoc = new Position;
    if (forceRegexp) return readRegexp();
    if (tokPos >= inputLen) return finishToken(_eof);
    if (tokType === _newline) return readToken_indent();

    var code = input.charCodeAt(tokPos);
    // Identifier or keyword. '\uXXXX' sequences are allowed in
    // identifiers, so '\' also dispatches to that.
    if (isIdentifierStart(code) || code === 92 /* '\' */) return readWord();

    var tok = getTokenFromCode(code);

    if (tok === false) {
      // If we are here, we either found a non-ASCII identifier
      // character, or something that's entirely disallowed.
      var ch = String.fromCharCode(code);
      if (ch === "\\" || nonASCIIidentifierStart.test(ch)) return readWord();
      raise(tokPos, "Unexpected character '" + ch + "'");
    }
    return tok;
  }

  function finishOp(type, size) {
    var str = input.slice(tokPos, tokPos + size);
    tokPos += size;
    finishToken(type, str);
  }

  // Parse a regular expression. Some context-awareness is necessary,
  // since a '/' inside a '[]' set does not end the expression.

  function readRegexp() {
    var content = "", escaped, inClass, start = tokPos;
    for (;;) {
      if (tokPos >= inputLen) raise(start, "Unterminated regular expression");
      var ch = input.charAt(tokPos);
      if (newline.test(ch)) raise(start, "Unterminated regular expression");
      if (!escaped) {
        if (ch === "[") inClass = true;
        else if (ch === "]" && inClass) inClass = false;
        else if (ch === "/" && !inClass) break;
        escaped = ch === "\\";
      } else escaped = false;
      ++tokPos;
    }
    var content = input.slice(start, tokPos);
    ++tokPos;
    // Need to use `readWord1` because '\uXXXX' sequences are allowed
    // here (don't ask).
    var mods = readWord1();
    if (mods && !/^[gmsiy]*$/.test(mods)) raise(start, "Invalid regular expression flag");
    try {
      var value = new RegExp(content, mods);
    } catch (e) {
      if (e instanceof SyntaxError) raise(start, "Error parsing regular expression: " + e.message);
      raise(e);
    }
    return finishToken(_regexp, value);
  }

  // Read an integer in the given radix. Return null if zero digits
  // were read, the integer value otherwise. When `len` is given, this
  // will return `null` unless the integer has exactly `len` digits.

  function readInt(radix, len) {
    var start = tokPos, total = 0;
    for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
      var code = input.charCodeAt(tokPos), val;
      if (code >= 97) val = code - 97 + 10; // a
      else if (code >= 65) val = code - 65 + 10; // A
      else if (code >= 48 && code <= 57) val = code - 48; // 0-9
      else val = Infinity;
      if (val >= radix) break;
      ++tokPos;
      total = total * radix + val;
    }
    if (tokPos === start || len != null && tokPos - start !== len) return null;

    return total;
  }

  function readHexNumber() {
    tokPos += 2; // 0x
    var val = readInt(16);
    if (val == null) raise(tokStart + 2, "Expected hexadecimal number");
    if (isIdentifierStart(input.charCodeAt(tokPos))) raise(tokPos, "Identifier directly after number");
    return finishToken(_num, val);
  }

  // Read an integer, octal integer, or floating-point number.

  function readNumber(startsWithDot) {
    var start = tokPos, isFloat = false, octal = input.charCodeAt(tokPos) === 48;
    if (!startsWithDot && readInt(10) === null) raise(start, "Invalid number");
    if (input.charCodeAt(tokPos) === 46) {
      ++tokPos;
      readInt(10);
      isFloat = true;
    }
    var next = input.charCodeAt(tokPos);
    if (next === 69 || next === 101) { // 'eE'
      next = input.charCodeAt(++tokPos);
      if (next === 43 || next === 45) ++tokPos; // '+-'
      if (readInt(10) === null) raise(start, "Invalid number");
      isFloat = true;
    }
    if (isIdentifierStart(input.charCodeAt(tokPos))) raise(tokPos, "Identifier directly after number");

    var str = input.slice(start, tokPos), val;
    if (isFloat) val = parseFloat(str);
    else if (!octal || str.length === 1) val = parseInt(str, 10);
    else if (/[89]/.test(str) || strict) raise(start, "Invalid number");
    else val = parseInt(str, 8);
    return finishToken(_num, val);
  }

  // Read a string value, interpreting backslash-escapes.

  function readString(quote) {
    tokPos++;
    var out = "";
    for (;;) {
      if (tokPos >= inputLen) raise(tokStart, "Unterminated string constant");
      var ch = input.charCodeAt(tokPos);
      if (ch === quote) {
        ++tokPos;
        return finishToken(_string, out);
      }
      if (ch === 92) { // '\'
        ch = input.charCodeAt(++tokPos);
        var octal = /^[0-7]+/.exec(input.slice(tokPos, tokPos + 3));
        if (octal) octal = octal[0];
        while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, -1);
        if (octal === "0") octal = null;
        ++tokPos;
        if (octal) {
          if (strict) raise(tokPos - 2, "Octal literal in strict mode");
          out += String.fromCharCode(parseInt(octal, 8));
          tokPos += octal.length - 1;
        } else {
          switch (ch) {
          case 110: out += "\n"; break; // 'n' -> '\n'
          case 114: out += "\r"; break; // 'r' -> '\r'
          case 120: out += String.fromCharCode(readHexChar(2)); break; // 'x'
          case 117: out += String.fromCharCode(readHexChar(4)); break; // 'u'
          case 85: out += String.fromCharCode(readHexChar(8)); break; // 'U'
          case 116: out += "\t"; break; // 't' -> '\t'
          case 98: out += "\b"; break; // 'b' -> '\b'
          case 118: out += "\u000b"; break; // 'v' -> '\u000b'
          case 102: out += "\f"; break; // 'f' -> '\f'
          case 48: out += "\0"; break; // 0 -> '\0'
          case 13: if (input.charCodeAt(tokPos) === 10) ++tokPos; // '\r\n'
          case 10: // ' \n'
            if (options.locations) { tokLineStart = tokPos; ++tokCurLine; }
            break;
          default: out += String.fromCharCode(ch); break;
          }
        }
      } else {
        if (ch === 13 || ch === 10 || ch === 8232 || ch === 8233) raise(tokStart, "Unterminated string constant");
        out += String.fromCharCode(ch); // '\'
        ++tokPos;
      }
    }
  }

  // Used to read character escape sequences ('\x', '\u', '\U').

  function readHexChar(len) {
    var n = readInt(16, len);
    if (n === null) raise(tokStart, "Bad character escape sequence");
    return n;
  }

  // Used to signal to callers of `readWord1` whether the word
  // contained any escape sequences. This is needed because words with
  // escape sequences must not be interpreted as keywords.

  var containsEsc;

  // Read an identifier, and return it as a string. Sets `containsEsc`
  // to whether the word contained a '\u' escape.
  //
  // Only builds up the word character-by-character when it actually
  // containeds an escape, as a micro-optimization.

  function readWord1() {
    containsEsc = false;
    var word, first = true, start = tokPos;
    for (;;) {
      var ch = input.charCodeAt(tokPos);
      if (isIdentifierChar(ch)) {
        if (containsEsc) word += input.charAt(tokPos);
        ++tokPos;
      } else if (ch === 92) { // "\"
        if (!containsEsc) word = input.slice(start, tokPos);
        containsEsc = true;
        if (input.charCodeAt(++tokPos) != 117) // "u"
          raise(tokPos, "Expecting Unicode escape sequence \\uXXXX");
        ++tokPos;
        var esc = readHexChar(4);
        var escStr = String.fromCharCode(esc);
        if (!escStr) raise(tokPos - 1, "Invalid Unicode escape");
        if (!(first ? isIdentifierStart(esc) : isIdentifierChar(esc)))
          raise(tokPos - 4, "Invalid Unicode escape");
        word += escStr;
      } else {
        break;
      }
      first = false;
    }
    return containsEsc ? word : input.slice(start, tokPos);
  }

  // Read an identifier or keyword token. Will check for reserved
  // words when necessary.

  function readWord() {
    var word = readWord1();
    var type = _name;
    if (!containsEsc && isKeyword(word))
      type = keywordTypes[word];
    return finishToken(type, word);
  }

  // ## Parser

  // A recursive descent parser operates by defining functions for all
  // syntactic elements, and recursively calling those, each function
  // advancing the input stream and returning an AST node. Precedence
  // of constructs (for example, the fact that `!x[1]` means `!(x[1])`
  // instead of `(!x)[1]` is handled by the fact that the parser
  // function that parses unary prefix operators is called first, and
  // in turn calls the function that parses `[]` subscripts — that
  // way, it'll receive the node for `x[1]` already parsed, and wraps
  // *that* in the unary operator node.
  //
  // Acorn uses an [operator precedence parser][opp] to handle binary
  // operator precedence, because it is much more compact than using
  // the technique outlined above, which uses different, nesting
  // functions to specify precedence, for all of the ten binary
  // precedence levels that JavaScript defines.
  //
  // [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

  // ### Parser utilities

  // Continue to the next token.

  function next() {
    if (tokType === _dedent) {
      if (tokCurDedent < 1 || tokCurIndent.length < 1) unexpected();
      --tokCurDedent;
      tokCurIndent.pop();
      if (tokCurDedent > 0) return;
    }
    lastStart = tokStart;
    lastEnd = tokEnd;
    lastEndLoc = tokEndLoc;
    readToken();
  }

  // Enter strict mode. Re-reads the next token to please pedantic
  // tests ("use strict"; 010; -- should fail).

  function setStrict(strct) {
    strict = strct;
    tokPos = tokStart;
    if (options.locations) {
      while (tokPos < tokLineStart) {
        tokLineStart = input.lastIndexOf("\n", tokLineStart - 2) + 1;
        --tokCurLine;
      }
    }
    skipSpace();
    readToken();
  }

  // Start an AST node, attaching a start offset.

  function Node() {
    this.type = null;
    this.start = tokStart;
    this.end = null;
  }

  exports.Node = Node;

  function SourceLocation() {
    this.start = tokStartLoc;
    this.end = null;
    if (sourceFile !== null) this.source = sourceFile;
  }

  function startNode() {
    var node = new Node();
    if (options.locations)
      node.loc = new SourceLocation();
    if (options.directSourceFile)
      node.sourceFile = options.directSourceFile;
    if (options.ranges)
      node.range = [tokStart, 0];
    return node;
  }

  // Start a node whose start offset information should be based on
  // the start of another node. For example, a binary operator node is
  // only started after its left-hand side has already been parsed.

  function startNodeFrom(other) {
    var node = new Node();
    node.start = other.start;
    if (options.locations) {
      node.loc = new SourceLocation();
      node.loc.start = other.loc.start;
    }
    if (options.ranges)
      node.range = [other.range[0], 0];

    return node;
  }

  // Finish an AST node, adding `type` and `end` properties.

  function finishNode(node, type) {
    node.type = type;
    node.end = lastEnd;
    if (options.locations)
      node.loc.end = lastEndLoc;
    if (options.ranges)
      node.range[1] = lastEnd;

    // Exclude start/end from final node.  locations and ranges options cover this.
    delete node.start;
    delete node.end;

    return node;
  }

  function createNode(type, props) {
    var node = startNode();
    for (var prop in props) {
      node[prop] = props[prop];
    }
    node = finishNode(node, type);
    return node;
  }

  function createNodeFrom(other, type, props) {
    var node = startNodeFrom(other);
    for (var prop in props) {
      node[prop] = props[prop];
    }
    node = finishNode(node, type);
    return node;
  }

  function createNodeMemberCall(node, object, property, args) {
    var objId = createNode("Identifier", { name: object });
    var propId = createNode("Identifier", { name: property });
    var member = createNode("MemberExpression", { object: objId, property: propId, computed: false });
    node.callee = member
    node.arguments = args;
    return finishNode(node, "CallExpression");
  }

  function createVarDeclFromId(refNode, id, init) {
    var decl = startNodeFrom(refNode);
    decl.id = id;
    decl.init = init;
    decl = finishNode(decl, "VariableDeclarator");
    var declDecl = startNodeFrom(refNode);
    declDecl.kind = "var";
    declDecl.declarations = [decl];
    return finishNode(declDecl, "VariableDeclaration");
  }

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

  // Verify that a node is an lval — something that can be assigned
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

  function unpackTuple(noIn, tupleArgs, right) {
    if (!tupleArgs || tupleArgs.length < 1) unexpected();

    var varStmts = [];

    // var tmp = right

    var tmpId = createNodeFrom(tupleArgs[0], "Identifier", { name: "filbertTmp" + newAstIdCount++ });
    var tmpDecl = createVarDeclFromId(tmpId, tmpId, right);
    varStmts.push(tmpDecl)

    // argN = tmp[N]

    for (var i = 0; i < tupleArgs.length; i++) {
      var lval = tupleArgs[i];
      checkLVal(lval);
      var indexId = createNodeFrom(lval, "Literal", { value: i });
      var init = createNodeFrom(lval, "MemberExpression", { object: tmpId, property: indexId, computed: true });
      if (lval.type === "Identifier" && !scope.exists(lval.name)) {
        scope.addVar(lval.name);
        var varDecl = createVarDeclFromId(lval, lval, init);
        varStmts.push(varDecl);
      }
      else {
        var node = startNodeFrom(lval);
        node.left = lval;
        node.operator = "=";
        node.right = init;
        node = finishNode(node, "AssignmentExpression");
        varStmts.push(createNodeFrom(node, "ExpressionStatement", { expression: node }));
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
    labels = [];
    readToken();

    var node = program || startNode(), first = true;
    if (!program) node.body = [];
    while (tokType !== _eof) {
      var stmt = parseStatement();
      if (stmt) node.body.push(stmt);
      first = false;
    }
    return finishNode(node, "Program");
  }

  var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

  // Parse a single statement.
  //
  // If expecting a statement and finding a slash operator, parse a
  // regular expression literal. This is to handle cases like
  // `if (foo) /blah/.exec(foo);`, where looking at the previous token
  // does not help.

  function parseStatement() {
    if (tokType === _slash || tokType === _assign && tokVal == "/=")
      readToken(true);

    var starttype = tokType, node = startNode();

    // Most types of statements are recognized by the keyword they
    // start with. Many are trivial to parse, some require a bit of
    // complexity.

    switch (starttype) {

    case _break:
      next();
      return finishNode(node, "BreakStatement");

    case _continue:
      next();
      return finishNode(node, "ContinueStatement");

    case _class:
      next();
      return parseClass(node);

    case _def:
      next();
      return parseFunction(node);

    case _for:
      next();
      return parseFor(node);

    case _from: // Skipping from and import statements for now
      skipLine();
      next();
      return parseStatement();

    case _if: case _elif:
      next();
      if (tokType === _parenL) node.test = parseParenExpression();
      else node.test = parseExpression();
      expect(_colon);
      node.consequent = parseSuite();
      if (tokType === _elif)
        node.alternate = parseStatement();
      else
        node.alternate = eat(_else) && eat(_colon) ? parseSuite() : null;
      return finishNode(node, "IfStatement");

    case _import: // Skipping from and import statements for now
      skipLine();
      next();
      return parseStatement();

    case _newline:
      // TODO: parseStatement() should probably eat it's own newline
      next();
      return null;

    case _pass:
      next();
      return finishNode(node, "EmptyStatement");

    case _return:
      if (!inFunction && !options.allowReturnOutsideFunction)
        raise(tokStart, "'return' outside of function");
      next();
      if (tokType ===_newline || tokType === _eof) node.argument = null;
      else { node.argument = parseExpression();}
      return finishNode(node, "ReturnStatement");

    case _try: // TODO, and remove parseBlock
      next();
      node.block = parseBlock();
      node.handler = null;
      if (tokType === _catch) {
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

    case _while:
      next();
      if (tokType === _parenL) node.test = parseParenExpression();
      else node.test = parseExpression();
      expect(_colon);
      node.body = parseSuite();
      return finishNode(node, "WhileStatement");

    case _with: // TODO
      if (strict) raise(tokStart, "'with' in strict mode");
      next();
      node.object = parseParenExpression();
      node.body = parseStatement();
      return finishNode(node, "WithStatement");

    case _semi:
      next();
      return finishNode(node, "EmptyStatement");

      // Assume it's an ExpressionStatement. If an assign has been 
      // converted to a variable declaration, pass it up as is.

    default:
      var expr = parseExpression();
      if (expr.type === "VariableDeclaration" || expr.type === "BlockStatement") {
        return expr;
      } else {
        node.expression = expr;
        return finishNode(node, "ExpressionStatement");
      }
    }
  }

  // Used for constructs like `switch` and `if` that insist on
  // parentheses around their expression.

  function parseParenExpression() {
    expect(_parenL);
    var val = parseExpression();
    expect(_parenR);
    return val;
  }

  // Parse indent-enclosed block of statements

  function parseBlock() {
    var node = startNode();
    node.body = [];
    while (tokType !== _dedent && tokType !== _eof) {
      var stmt = parseStatement();
      node.body.push(stmt);
    }
    if (tokType === _dedent) next();
    return finishNode(node, "BlockStatement");
  }

  // Parse 'suite' from Python grammar spec
  // Will replace parseBlock eventually

  function parseSuite() {
    var node = startNode();
    node.body = [];
    if (eat(_newline)) {
      eat(_indent);
      while (!eat(_dedent) && !eat(_eof)) {
        var stmt = parseStatement();
        if (stmt) node.body.push(stmt);
      }
    } else {
      node.body.push(parseStatement());
      next();
    }
    return finishNode(node, "BlockStatement");
  }

  // Parse for/in loop
  // Problem:
  // 1. JavaScript for/in loop iterates on properties, which are the indexes for an Array
  //    Python iterates on the list items themselves, not indexes
  // 2. JavaScript for/in does not necessarily iterate in order
  // Solution:
  // Generate extra AST to do the right thing at runtime
  // If iterating through an ordered sequence, return something like: 
  // { var __right = right; 
  //    if (__right instanceof Array) { 
  //      for(var __index=0; __index < __right.length; __index++) {
  //        i = __right[__index]; 
  //        ...
  //      } 
  //    } else { 
  //      for(i in __right){...} 
  //    }
  // }
  // When the loop target is a Tuple, it is unpacked into each for body in the example above.
  // E.g. 'for k, v in __right: total += v' becomes:
  // for (var __tmp in __right) {
  //    k = __tmp[0];
  //    v = __tmp[1];
  //    total += v;
  // }

  // TODO: Extra AST nodes have program end for their start and end.  What should they be?
  // TODO: for/in on a string should go through items, not indexes. String obj and string literal.

  function parseFor(node) {
    var init = parseExpression(false, true);
    var tupleArgs = getTupleArgs(init);
    if (!tupleArgs) checkLVal(init);
    expect(_in);
    var right = parseExpression();
    expect(_colon);
    var forOrderedBody = parseSuite();
    var forInBody = JSON.parse(JSON.stringify(forOrderedBody));

    var arrayId = createNode("Identifier", { name: "Array" });
    var lengthId = createNode("Identifier", { name: "length" });
    var undefinedId = createNode("Identifier", { name: "undefined" });
    var zeroLit = createNode("Literal", { value: 0 });

    // var __rightN = right

    var rightId = createNode("Identifier", { name: "filbertRight" + newAstIdCount });
    var rightAssign = createVarDeclFromId(node, rightId, right);

    // for (var __indexN; __indexN < __rightN.length; ++__indexN)

    var forOrderedIndexId = createNode("Identifier", { name: "filbertIndex" + newAstIdCount });
    var forOrderedIndexDeclr = createNode("VariableDeclarator", { id: forOrderedIndexId, init: zeroLit });
    var forOrderedIndexDecln = createNode("VariableDeclaration", { declarations: [forOrderedIndexDeclr], kind: "var" });
    var forOrderedTestMember = createNode("MemberExpression", { object: rightId, property: lengthId, computed: false });
    var forOrderedTestBinop = createNode("BinaryExpression", { left: forOrderedIndexId, operator: "<", right: forOrderedTestMember });
    var forOrderedUpdate = createNode("UpdateExpression", { operator: "++", prefix: true, argument: forOrderedIndexId });
    var forOrderedMember = createNode("MemberExpression", { object: rightId, property: forOrderedIndexId, computed: true });

    if (tupleArgs) {
      var varStmts = unpackTuple(true, tupleArgs, forOrderedMember);
      for (var i = varStmts.length - 1; i >= 0; i--) forOrderedBody.body.unshift(varStmts[i]);
    }
    else {
      if (init.type === "Identifier" && !scope.exists(init.name)) {
        scope.addVar(init.name);
        forOrderedBody.body.unshift(createVarDeclFromId(init, init, forOrderedMember));
      } else {
        var forOrderedInit = createNode("AssignmentExpression", { operator: "=", left: init, right: forOrderedMember });
        var forOrderedInitStmt = createNode("ExpressionStatement", { expression: forOrderedInit });
        forOrderedBody.body.unshift(forOrderedInitStmt);
      }
    }

    var forOrdered = createNode("ForStatement", { init: forOrderedIndexDecln, test: forOrderedTestBinop, update: forOrderedUpdate, body: forOrderedBody });
    var forOrderedBlock = createNode("BlockStatement", { body: [forOrdered] });

    // for (init in __rightN)

    var forInLeft = init;
    if (tupleArgs) {
      var varStmts = unpackTuple(true, tupleArgs, null);
      forInLeft = varStmts[0];
      for (var i = varStmts.length - 1; i > 0; i--) forInBody.body.unshift(varStmts[i]);
    }
    else if (init.type === "Identifier" && !scope.exists(init.name)) {
      scope.addVar(init.name);
      forInLeft = createVarDeclFromId(init, init, null);
    }
    var forIn = createNode("ForInStatement", { left: forInLeft, right: rightId, body: forInBody });
    var forInBlock = createNode("BlockStatement", { body: [forIn] });

    // if ordered sequence then forOrdered else forIn

    var ifTest = createNode("BinaryExpression", { left: rightId, operator: "instanceof", right: arrayId });
    var ifStmt = createNode("IfStatement", { test: ifTest, consequent: forOrderedBlock, alternate: forInBlock });

    node.body = [rightAssign, ifStmt];

    newAstIdCount++;

    return finishNode(node, "BlockStatement");
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

  // Parse an assignment expression. This includes applications of
  // operators like `+=`.
  // Add 'this.' to assignments in a class constructor.
  // Convert identifier assignment to variable declaration if the
  // identifier doesn't exist in this namespace yet.

  function parseMaybeAssign(noIn) {
    var left = parseMaybeTuple(noIn);
    if (tokType.isAssign) {
      var tupleArgs = getTupleArgs(left);
      if (tupleArgs && tokType.isAssign) {
        next();
        var right = parseMaybeTuple(noIn);
        var blockNode = startNodeFrom(left);
        blockNode.body = unpackTuple(noIn, tupleArgs, right);
        return finishNode(blockNode, "BlockStatement")
      }

      if (scope.isClass()) {
        var thisExpr = createNodeFrom(left, "ThisExpression");
        left = createNodeFrom(left, "MemberExpression", { object: thisExpr, property: left });
      }
      var node = startNodeFrom(left);
      node.operator = tokVal;
      node.left = left;
      next();
      node.right = parseMaybeTuple(noIn);
      checkLVal(left);
      if (left.type === "Identifier" && !scope.exists(left.name)) {
        scope.addVar(left.name);
        return createVarDeclFromId(node, node.left, node.right);
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
    var prec = op === _logicalNOT ? _in.prec : op.prec;
    if (op === _exponentiation && prec >= minPrec) {
      node = startNodeFrom(left);
      next();
      right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
      exprNode = createNodeMemberCall(node, "Math", "pow", [left, right]);
      return parseExprOp(exprNode, minPrec, noIn);
    } else if (prec != null && (!noIn || op !== _in)) {
      if (prec > minPrec) {
        next();
        node = startNodeFrom(left);
        if (op === _floorDiv) {
          right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
          var binExpr = createNode("BinaryExpression", { left: left, operator: '/', right: right });
          exprNode = createNodeMemberCall(node, "Math", "floor", [binExpr]);
        } else if (op === _in || op === _logicalNOT) {
          if (op === _in || eat(_in)) {
            right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
            var zeroLit = createNode("Literal", { value: 0 });
            var indexOfLit = createNode("Literal", { name: "indexOf" });
            var memberExpr = createNode("MemberExpression", { object: right, property: indexOfLit, computed: false });
            var callExpr = createNode("CallExpression", { callee: memberExpr, arguments: [left] });
            exprNode = createNode("BinaryExpression", { left: callExpr, operator: op === _in ? ">=" : "<", right: zeroLit });
          } else raise(tokPos, "Expected 'not in' comparison operator");
        } else {
          if (op === _is) {
            if (eat(_logicalNOT)) node.operator = "!==";
            else node.operator = "===";
          } else node.operator = op.rep != null ? op.rep : val;
          node.left = left;
          node.right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
          exprNode = finishNode(node, (op === _logicalOR || op === _logicalAND) ? "LogicalExpression" : "BinaryExpression");
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
    var expr = parseExprSubscripts();
    return expr;
  }

  // Parse call, dot, and `[]`-subscript expressions.

  function parseExprSubscripts() {
    return parseSubscripts(parseExprAtom());
  }

  function parseSubscripts(base, noCalls) {
    if (eat(_dot)) {
      var node = startNodeFrom(base);
      var id = parseIdent(true);
      if (pythonRuntime.imports[base.name] && pythonRuntime.imports[base.name][id.name]) {
        // Calling a Python import function
        var runtimeId = createNode("Identifier", { name: options.runtimeParamName });
        var importsId = createNode("Identifier", { name: "imports" });
        var runtimeMember = createNode("MemberExpression", { object: runtimeId, property: importsId, computed: false });
        node.object = createNode("MemberExpression", { object: runtimeMember, property: base, computed: false });
      } else if (base.name && base.name === scope.getThisReplace()) {
        node.object = createNodeFrom(base, "ThisExpression");
      } else node.object = base;
      node.property = id;
      node.computed = false;
      return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
    } else if (eat(_bracketL)) {
      var node = startNodeFrom(base);
      node.object = base;
      node.property = parseExpression();
      node.computed = true;
      expect(_bracketR);
      return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
    } else if (!noCalls && eat(_parenL)) {
      var node = startNodeFrom(base);
      if (pythonRuntime.functions[base.name]) {
        // Calling a Python built-in function
        if (base.type !== "Identifier") unexpected();
        var runtimeId = createNode("Identifier", { name: options.runtimeParamName });
        var functionsId = createNode("Identifier", { name: "functions" });
        var runtimeMember = createNode("MemberExpression", { object: runtimeId, property: functionsId, computed: false });
        node.callee = createNode("MemberExpression", { object: runtimeMember, property: base, computed: false });
      } else node.callee = base;
      node.arguments = parseExprList(_parenR, false);
      if (scope.isNewObj(base.name))
        return parseSubscripts(finishNode(node, "NewExpression"), noCalls);
      return parseSubscripts(finishNode(node, "CallExpression"), noCalls);
    }
    return base;
  }

  // Parse an atomic expression — either a single token that is an
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
        var node = parseTuple(true);
        eat(_parenR);
        return node;
      }
      var val = parseMaybeTuple(true);
      val.start = tokStart1;
      val.end = tokEnd;
      if (options.locations) {
        val.loc.start = tokStartLoc1;
        val.loc.end = tokEndLoc;
      }
      if (options.ranges)
        val.range = [tokStart1, tokEnd];
      expect(_parenR);
      return val;

    // Custom list object is used to simulate native Python list
    // E.g. Python '[]' becomes JavaScript 'new __pythonRuntime.objects.list();'

    case _bracketL:
      var node = startNode();
      next();
      var runtimeId = createNode("Identifier", { name: options.runtimeParamName });
      var objectsId = createNode("Identifier", { name: "objects" });
      var runtimeMember = createNode("MemberExpression", { object: runtimeId, property: objectsId, computed: false });
      var listId = createNode("Identifier", { name: "list" });
      node.callee = createNode("MemberExpression", { object: runtimeMember, property: listId, computed: false });
      node.arguments = parseExprList(_bracketR, true, false);
      return finishNode(node, "NewExpression");

    case _braceL:
	    return parseDict(_braceR);

    default:
      unexpected();
    }
  }

  // Parse class

  function parseClass(ctorNode) {
    ctorNode.id = parseIdent();
    ctorNode.params = [];
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

    scope.startClass(ctorNode.id.name);

    // Container for class constructor and prototype functions

    var container = startNode();
    container.body = [];

    // Parse class body

    var classBlock = parseSuite();

    // Helper to identify class methods which were parsed onto the class prototype

    function getPrototype(stmt) {
      if (stmt.expression && stmt.expression.left && stmt.expression.left.object &&
        stmt.expression.left.object.property && stmt.expression.left.object.property.name === "prototype")
        return stmt.expression.left.property.name;
      return null;
    }

    // Start building class constructor

    var ctorBlock = startNodeFrom(container);
    ctorBlock.body = [];

    // Add parent class constructor call

    for (var i in classParams) {
      var objId = createNode("Identifier", { name: classParams[0].name });
      var propertyId = createNode("Identifier", { name: "call" });
      var calleeMember = createNode("MemberExpression", { object: objId, property: propertyId, computed: false });
      var thisExpr = createNode("ThisExpression");
      var callExpr = createNode("CallExpression", { callee: calleeMember, arguments: [thisExpr] });
      var superExpr = createNode("ExpressionStatement", { expression: callExpr });
      ctorBlock.body.push(superExpr);
    }

    // Add non-function statements and contents of special '__init__' method

    for (var i in classBlock.body) {
      var stmt = classBlock.body[i];
      var prototype = getPrototype(stmt);
      if (!prototype) {
        ctorBlock.body.push(stmt);
      }
      else if (prototype === "__init__") {
        for (var j in stmt.expression.right.body.body)
          ctorBlock.body.push(stmt.expression.right.body.body[j]);
        ctorNode.params = stmt.expression.right.params;
      }
    }

    // Finish class constructor

    ctorNode.body = finishNode(ctorBlock, "BlockStatement");
    ctorNode = finishNode(ctorNode, "FunctionDeclaration");
    container.body.push(ctorNode);

    // Add inheritance via 'MyClass.prototype = Object.create(ParentClass.prototype)'

    if (classParams.length === 1) {
      var childClassId = createNode("Identifier", { name: ctorNode.id.name });
      var childPrototypeId = createNode("Identifier", { name: "prototype" });
      var childPrototypeMember = createNode("MemberExpression", { object: childClassId, property: childPrototypeId, computed: false });
      var parentClassId = createNode("Identifier", { name: classParams[0].name });
      var parentPrototypeId = createNode("Identifier", { name: "prototype" });
      var parentPrototypeMember = createNode("MemberExpression", { object: parentClassId, property: parentPrototypeId, computed: false });
      var objClassId = createNode("Identifier", { name: "Object" });
      var objCreateId = createNode("Identifier", { name: "create" });
      var objPropertyMember = createNode("MemberExpression", { object: objClassId, property: objCreateId, computed: false });
      var callExpr = createNode("CallExpression", { callee: objPropertyMember, arguments: [parentPrototypeMember] });
      var assignExpr = createNode("AssignmentExpression", { left: childPrototypeMember, operator: "=", right: callExpr });
      var inheritanceExpr = createNode("ExpressionStatement", { expression: assignExpr });
      container.body.push(inheritanceExpr);
    }

    // Add class methods, which are already prototype assignments

    for (var i in classBlock.body) {
      var stmt = classBlock.body[i];
      var prototype = getPrototype(stmt);
      if (prototype && prototype !== "__init__")
        container.body.push(stmt);
    }

    scope.end();

    return finishNode(container, "BlockStatement");
  }

  // Parse dictionary
  // Custom dict object used to simulate native Python dict
  // E.g. "{'k1':'v1', 'k2':'v2'}" becomes "new __pythonRuntime.objects.dict(['k1', 'v1'], ['k2', 'v2']);"

  function parseDict(tokClose) {
    var node = startNode(), first = true, key, value;
    node.arguments = [];
    next();
    var runtimeId = createNode("Identifier", { name: options.runtimeParamName });
    var objectsId = createNode("Identifier", { name: "objects" });
    var runtimeMember = createNode("MemberExpression", { object: runtimeId, property: objectsId, computed: false });
    var listId = createNode("Identifier", { name: "dict" });
    node.callee = createNode("MemberExpression", { object: runtimeMember, property: listId, computed: false });
    while (!eat(tokClose)) {
      if (!first) {
        expect(_comma);
      } else first = false;

      if (tokClose === _braceR) {
        key = parsePropertyName();
        expect(_colon);
        value = parseExprOps(true);
      } else if (tokClose === _parenR) {
        var keyId = parseIdent(true);
        key = startNodeFrom(keyId);
        key.value = keyId.name;
        key = finishNode(key, "Literal");
        expect(_eq);
        value = parseExprOps(true);
      } else unexpected();
      node.arguments.push(createNode("ArrayExpression", { elements: [key, value] }));
    }
    return finishNode(node, "NewExpression");
  }

  function parsePropertyName() {
    if (tokType === _num || tokType === _string) return parseExprAtom();
    return parseIdent(true);
  }

  function parseFunction(node) {
    node.id = parseIdent();
    node.params = [];
    var first = true;
    expect(_parenL);
    while (!eat(_parenR)) {
      if (!first) expect(_comma); else first = false;
      node.params.push(parseIdent());
    }
    expect(_colon);

    // Start a new scope with regard to labels and the `inFunction`
    // flag (restore them to their old value afterwards).
    var oldInFunc = inFunction, oldLabels = labels;
    inFunction = true; labels = [];

    scope.startFn(node.id.name);

    // If class method, remove class instance var from params and save for 'this' replacement
    if (scope.isParentClass()) {
      var selfId = node.params.shift();
      scope.setThisReplace(selfId.name);
    }

    node.body = parseSuite();

    inFunction = oldInFunc; labels = oldLabels;

    // Verify that argument names
    // are not repeated, and it does not try to bind the words `eval`
    // or `arguments`.
    for (var i = node.id ? -1 : 0; i < node.params.length; ++i) {
      var id = i < 0 ? node.id : node.params[i];
      if (isStrictBadIdWord(id.name))
        raise(id.start, "Defining '" + id.name + "' in strict mode");
      if (i >= 0) for (var j = 0; j < i; ++j) if (id.name === node.params[j].name)
        raise(id.start, "Argument name clash");
    }

    // If class method, replace with prototype function literals
    var retNode;
    if (scope.isParentClass()) {
      var classId = createNode("Identifier", { name: scope.getParentClassName() });
      var prototypeId = createNode("Identifier", { name: "prototype" });
      var functionId = node.id;
      var prototypeMember = createNode("MemberExpression", { object: classId, property: prototypeId, computed: false });
      var functionMember = createNode("MemberExpression", { object: prototypeMember, property: functionId, computed: false });
      var functionExpr = createNode("FunctionExpression", { body: node.body, params: node.params });
      var assignExpr = createNode("AssignmentExpression", { left: functionMember, operator: "=", right: functionExpr });
      retNode = createNode("ExpressionStatement", { expression: assignExpr });
    } else retNode = finishNode(node, "FunctionDeclaration");

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
      else elts.push(parseExprOps(true));
    }
    return elts;
  }

  // Parse the next token as an identifier. If `liberal` is true (used
  // when parsing properties), it will also convert keywords into
  // identifiers.

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
    var runtimeId = createNode("Identifier", { name: options.runtimeParamName });
    var objectsId = createNode("Identifier", { name: "objects" });
    var runtimeMember = createNode("MemberExpression", { object: runtimeId, property: objectsId, computed: false });
    var listId = createNode("Identifier", { name: "tuple" });

    var node = expr ? startNodeFrom(expr) : startNode();
    node.arguments = expr ? [expr] : [];
    node.callee = createNode("MemberExpression", { object: runtimeMember, property: listId, computed: false });

    // Tuple with single element has special trailing comma: t = 'hi',
    // Look ahead and eat comma in this scenario
    if (tokType === _comma) {
      var oldPos = tokPos; skipSpace();
      var newPos = tokPos; tokPos = oldPos;
      if (newPos >= inputLen || input[newPos] === ';' || newline.test(input[newPos])) eat(_comma);
    }

    while (eat(_comma)) {
      node.arguments.push(parseExprOps(noIn));
    }
    return finishNode(node, "NewExpression");
  }


  // ## Python runtime library

  var pythonRuntime = exports.pythonRuntime = {

    // Shim JavaScript objects that impersonate Python equivalents

    objects: {
      dict: function () {
        var obj = {};
        for (var i in arguments) obj[arguments[i][0]] = arguments[i][1];
        Object.defineProperty(obj, "items",
        {
          value: function () {
            var items = [];
            for (var k in this) items.push(new pythonRuntime.objects.tuple(k, this[k]));
            return items;
          },
          enumerable: false
        });
        Object.defineProperty(obj, "length",
        {
          get: function () {
            return Object.keys(this).length;
          },
          enumerable: false
        });
        Object.defineProperty(obj, "clear",
        {
          value: function () {
            for (var i in this) delete this[i];
          },
          enumerable: false
        });
        Object.defineProperty(obj, "get",
        {
          value: function (key, def) {
            if (key in this) return this[key];
            else if (def !== undefined) return def;
            return null;
          },
          enumerable: false
        });
        Object.defineProperty(obj, "keys",
        {
          value: function () {
            return Object.keys(this);
          },
          enumerable: false
        });
        Object.defineProperty(obj, "pop",
        {
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
        });
        Object.defineProperty(obj, "values",
        {
          value: function () {
            var values = [];
            for (var key in this) values.push(this[key]);
            return values;
          },
          enumerable: false
        });
        return obj;
      },
      list: function () {
        var arr = [];
        arr.push.apply(arr, arguments);
        Object.defineProperty(arr, "append",
        {
          value: function (x) {
            this.push(x);
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
        Object.defineProperty(arr, "copy",
        {
          value: function () {
            return this.slice(0);
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
        Object.defineProperty(arr, "extend",
        {
          value: function (L) {
            for (var i = 0; i < L.length; i++) this.push(L[i]);
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
        Object.defineProperty(arr, "insert",
        {
          value: function (i, x) {
            this.splice(i, 0, x);
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
        Object.defineProperty(arr, "remove",
        {
          value: function (x) {
            this.splice(this.indexOf(x), 1);
          },
          enumerable: false
        });
        return arr;
      },
      tuple: function () {
        var arr = [];
        arr.push.apply(arr, arguments);
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
        return arr;
      }
    },

    // Python built-in functions

    functions: {
      int: function (s) {
        return parseInt(s);
      },
      len: function (o) {
        return o.length;
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
          start = 0
          step = 1
        }
        else if (step === undefined) step = 1;
        var r = new pythonRuntime.objects.list();
        if (start < stop && step > 0 || start > stop && step < 0) {
          var i = start;
          while (i !== stop) {
            r.append(i);
            i += step;
          }
        }
        return r;
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
});