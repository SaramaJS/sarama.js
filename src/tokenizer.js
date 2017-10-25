// ## Tokenizer

class Tokenizer {
  constructor() {

  }

  // Filbert is organized as a tokenizer and a recursive-descent parser.
  // The `tokenize` export provides an interface to the tokenizer.
  // Because the tokenizer is optimized for being efficiently used by
  // the Filbert parser itself, this interface is somewhat crude and not
  // very modular. Performing another parse or call to `tokenize` will
  // reset the internal state, and invalidate existing tokenizers.

  tokenize(input, opts) {
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
}

// Reset the token state. Used at the start of a parse.

function initTokenState() {
  tokCurLine = 1;
  tokPos = tokLineStart = 0;
  tokRegexpAllowed = true;
  indentHist.init();
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
  if (type === _parenL || type === _braceL || type === _bracketL) ++bracketNesting;
  if (type === _parenR || type === _braceR || type === _bracketR) --bracketNesting;
  if (type !== _newline) skipSpace();
  tokVal = val;
  tokRegexpAllowed = type.beforeExpr;
}

function skipLine() {
  var ch = input.charCodeAt(++tokPos);
  while (tokPos < inputLen && !isNewline(ch)) {
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
    if (ch === 35) skipLineComment();
    else if (ch === 92) {
      ++tokPos;
      if (isNewline(input.charCodeAt(tokPos))) {
        if (input.charCodeAt(tokPos) === 13 && input.charCodeAt(tokPos+1) === 10) ++tokPos;
        ++tokPos;
        if (options.location) { tokLineStart = tokPos; ++tokCurLine; }
      } else {
        raise(tokPos, "Unexpected character after line continuation character");
      }
    }
    else if (isSpace(ch)) ++tokPos;
    else if (bracketNesting > 0 && isNewline(ch)) {
      if (ch === 13 && input.charCodeAt(tokPos+1) === 10) ++tokPos;
      ++tokPos;
      if (options.location) { tokLineStart = tokPos; ++tokCurLine; }
    }
    else break;
  }
}

function isSpace(ch) {
  if (ch === 32 || // ' '
    ch === 9 || ch === 11 || ch === 12 ||
    ch === 160 || // '\xa0'
    ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
    return true;
  }
  return false;
}

function isNewline(ch) {
  if (ch === 10 || ch === 13 ||
    ch === 8232 || ch === 8233) {
    return true;
  }
  return false;
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

// Parse indentation
// Possible output: _indent, _dedent, _eof, readToken()
// TODO: disallow unequal indents of same length (e.g. nested if/else block)

function readToken_indent() {
  // Read indent, skip empty lines and comments
  var indent = "";
  var indentPos = tokPos;
  var ch, next;
  while (indentPos < inputLen) {
    ch = input.charCodeAt(indentPos);
    if (isSpace(ch)) {
      indent += String.fromCharCode(ch);
      ++indentPos;
    } else if (isNewline(ch)) { // newline
      indent = "";
      if (ch === 13 && input.charCodeAt(indentPos + 1) === 10) ++indentPos;
      ++indentPos;
      tokPos = indentPos;
      if (options.locations) {
        tokLineStart = indentPos;
        ++tokCurLine;
      }
    } else if (ch === 35) { // '#'
      do {
        next = input.charCodeAt(++indentPos);
      } while (indentPos < inputLen && next !== 10);
      // TODO: call onComment
    } else {
      break;
    }
  }

  // Determine token type based on indent found versus indentation history
  var type;
  if (indent.length > 0) {
    if (indentHist.isIndent(indent)) {
      type = _indent;
      if (indentHist.count() >= 1) tokStart += indentHist.len(indentHist.count() - 1);
      indentHist.addIndent(indent);
    } else if (indentHist.isDedent(indent)) {
      type = _dedent;
      indentHist.addDedent(indent);
      var nextDedent = indentHist.count() - indentHist.dedentCount;
      if (nextDedent >= 2) {
        tokStart += indentHist.len(nextDedent) - indentHist.len(nextDedent - 1);
      }
    } else {
      tokPos += indent.length;
    }
  } else if (indentPos >= inputLen) {
    type = _eof;
  } else if (indentHist.count() > 0) {
    type = _dedent;
    indentHist.updateDedent();
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

    case 13: case 10: case 8232: case 8233:
    ++tokPos;
    if (code === 13 && input.charCodeAt(tokPos) === 10) ++tokPos;
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
    case 34: // '"'
      if (input.charCodeAt(tokPos + 1) === 34 && input.charCodeAt(tokPos + 2) === 34) {
        return readDocumentationString();
      }
    case 39: // "'"
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
  if (tokType === _dedent) {
    indentHist.pop();
    if (indentHist.dedentCount > 0) return;
  }

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
  var content = "", escaped, inClass, start = tokPos, value;
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
  content = input.slice(start, tokPos);
  ++tokPos;
  // Need to use `readWord1` because '\uXXXX' sequences are allowed
  // here (don't ask).
  var mods = readWord1();
  if (mods && !/^[gmsiy]*$/.test(mods)) raise(start, "Invalid regular expression flag");
  try {
    value = new RegExp(content, mods);
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

function readDocumentationString() {
  var out = "";
  tokPos += 3;
  for (;;) {
    if (tokPos >= inputLen) raise(tokStart, "Unterminated documentation string");
    var ch = input.charCodeAt(tokPos);
    if (ch === 34) {
      if (input.charCodeAt(tokPos + 1) === 34 &&
        input.charCodeAt(tokPos + 2) === 34) {
        tokPos += 3;
        return finishToken(_documentationString, out);
      }
    }
    if (isNewline(ch)) {
      out += String.fromCharCode(ch);
      ++tokPos;
      if (ch === 13 && input.charCodeAt(tokPos) === 10) {
        ++tokPos;
        out += "\n";
      }
      if (options.location) {
        tokLineStart = tokPos;
        ++tokCurLine;
      }
    } else {
      out += String.fromCharCode(ch); // '\'
      ++tokPos;
    }

  }
}
// Read a string value, interpreting backslash-escapes.

function readString(quote) {
  tokPos++;
  var ch = input.charCodeAt(tokPos);
  var tripleQuoted = false;
  if (ch === quote && input.charCodeAt(tokPos+1) === quote) {
    tripleQuoted = true;
    tokPos += 2;
  }
  var out = "";
  for (;;) {
    if (tokPos >= inputLen) raise(tokStart, "Unterminated string constant");
    var ch = input.charCodeAt(tokPos);
    if (ch === quote) {
      if (tripleQuoted) {
        if (input.charCodeAt(tokPos+1) === quote &&
          input.charCodeAt(tokPos+2) === quote) {
          tokPos += 3;
          return finishToken(_string, out);
        }
      } else {
        ++tokPos;
        return finishToken(_string, out);
      }
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
          case 85: // 'U'
            ch = readHexChar(8);
            if (ch < 0xFFFF && (ch < 0xD800 || 0xDBFF < ch)) out += String.fromCharCode(ch); // If it's UTF-16
            else { // If we need UCS-2
              ch -= 0x10000;
              out += String.fromCharCode((ch>>10)+0xd800)+String.fromCharCode((ch%0x400)+0xdc00);
            }
            break;
          case 116: out += "\t"; break; // 't' -> '\t'
          case 98: out += "\b"; break; // 'b' -> '\b'
          case 118: out += "\u000b"; break; // 'v' -> '\u000b'
          case 102: out += "\f"; break; // 'f' -> '\f'
          case 48: out += "\0"; break; // 0 -> '\0'
          case 13: if (input.charCodeAt(tokPos) === 10) ++tokPos; // '\r\n'
          case 10: // ' \n'
            if (options.locations) { tokLineStart = tokPos; ++tokCurLine; }
            break;
          default: out += '\\' + String.fromCharCode(ch); break; // Python doesn't remove slashes on failed escapes
        }
      }
    } else {
      if (isNewline(ch)) {
        if (tripleQuoted) {
          out += String.fromCharCode(ch);
          ++tokPos;
          if (ch === 13 && input.charCodeAt(tokPos) === 10) {
            ++tokPos;
            out += "\n";
          }
          if (options.location) { tokLineStart = tokPos; ++tokCurLine; }
        } else raise(tokStart, "Unterminated string constant");
      } else {
        out += String.fromCharCode(ch); // '\'
        ++tokPos;
      }
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