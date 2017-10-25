// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

// These are the general types. The `type` property is only used to
// make them recognizeable when debugging.

const _num = {type: "num"};
const _regexp = {type: "regexp"};
const _string = {type: "string"};
const _name = {type: "name"};
const _eof = {type: "eof"};
const _newline = {type: "newline"};
const _indent = {type: "indent"};
const _dedent = {type: "dedent"};
const _documentationString = {type: "documentation-string"};

// Keyword tokens. The `keyword` property (also used in keyword-like
// operators) indicates that the token originated from an
// identifier-like word, which is used when parsing property names.
//
// The `beforeExpr` property is used to disambiguate between regular
// expressions and divisions. It is set on all token types that can
// be followed by an expression (thus, a slash after them would be a
// regular expression).

const _dict = { keyword: "dict" };  // TODO: not a keyword
const _as = { keyword: "as" };
const _assert = { keyword: "assert" };
const _break = { keyword: "break" };
const _class = { keyword: "class" };
const _continue = { keyword: "continue" };
const _def = { keyword: "def" };
const _del = { keyword: "del" };
const _elif = { keyword: "elif", beforeExpr: true };
const _else = { keyword: "else", beforeExpr: true };
const _except = { keyword: "except", beforeExpr: true };
const _finally = {keyword: "finally"};
const _for = { keyword: "for" };
const _from = { keyword: "from" };
const _global = { keyword: "global" };
const _if = { keyword: "if" };
const _import = { keyword: "import" };
const _lambda = {keyword: "lambda"};
const _nonlocal = {keyword: "nonlocal"};
const _pass = { keyword: "pass" };
const _raise = {keyword: "raise"};
const _return = { keyword: "return", beforeExpr: true };
const _try = { keyword: "try" };
const _while = {keyword: "while"};
const _with = {keyword: "with"};
const _yield = {keyword: "yield"};

// The keywords that denote values.

const _none = {keyword: "None", atomValue: null};
const _true = {keyword: "True", atomValue: true};
const _false = {keyword: "False", atomValue: false};

// Some keywords are treated as regular operators. `in` sometimes
// (when parsing `for`) needs to be tested against specifically, so
// we assign a variable name to it for quick comparing.
// 'prec' is the operator precedence'

const _or = { keyword: "or", prec: 1, beforeExpr: true, rep: "||" };
const _and = { keyword: "and", prec: 2, beforeExpr: true, rep: "&&" };
const _not = { keyword: "not", prec: 3, prefix: true, beforeExpr: true, rep: "!" };
const _in = { keyword: "in", prec: 4, beforeExpr: true };
const _is = { keyword: "is", prec: 4, beforeExpr: true };

// Map keyword names to token types.
const keywordTypes = {
  "assert": _assert,
  "dict": _dict,
  "False": _false,
  "None": _none,
  "True": _true,
  "and": _and,
  "as": _as,
  "break": _break,
  "class": _class,
  "continue": _continue,
  "def": _def,
  "del": _del,
  "elif": _elif,
  "else": _else,
  "except": _except,
  "finally": _finally,
  "for": _for,
  "from": _from,
  "global": _global,
  "if": _if,
  "import": _import,
  "in": _in,
  "is": _is,
  "lambda": _lambda,
  "nonlocal": _nonlocal,
  "not": _not,
  "or": _or,
  "pass": _pass,
  "raise": _raise,
  "return": _return,
  "try": _try,
  "while": _while,
  "with": _with,
  "yield": _yield
};

// Punctuation token types. Again, the `type` property is purely for debugging.
const _bracketL = {type: "[", beforeExpr: true};
const _bracketR = {type: "]"};
const _braceL = {type: "{", beforeExpr: true};
const _braceR = {type: "}"};
const _parenL = {type: "(", beforeExpr: true};
const _parenR = {type: ")"};
const _comma = {type: ",", beforeExpr: true};
const _semi = {type: ";", beforeExpr: true};
const _colon = { type: ":", beforeExpr: true };
const _dot = { type: "." };
const _question = { type: "?", beforeExpr: true };

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

const _slash = { prec: 10, beforeExpr: true };
const _eq = { isAssign: true, beforeExpr: true };
const _assign = {isAssign: true, beforeExpr: true};
const _equality = { prec: 4, beforeExpr: true };
const _relational = {prec: 4, beforeExpr: true };
const _bitwiseOR = { prec: 5, beforeExpr: true };
const _bitwiseXOR = { prec: 6, beforeExpr: true };
const _bitwiseAND = { prec: 7, beforeExpr: true };
const _bitShift = { prec: 8, beforeExpr: true };
const _plusMin = { prec: 9, beforeExpr: true };
const _multiplyModulo = { prec: 10, beforeExpr: true };
const _floorDiv = { prec: 10, beforeExpr: true };
const _posNegNot = { prec: 11, prefix: true, beforeExpr: true };
const _bitwiseNOT = { prec: 11, prefix: true, beforeExpr: true };
const _exponentiation = { prec: 12, beforeExpr: true };

// Provide access to the token types for external users of the
// tokenizer.

module.exports = {
  assign: _assign,
  bitwiseOR: _bitwiseOR,
  bitwiseXOR: _bitwiseXOR,
  bitwiseAND: _bitwiseAND,
  bitShift: _bitShift,
  bitwiseNOT: _bitwiseNOT,
  bracketL: _bracketL,
  bracketR: _bracketR,
  braceL: _braceL,
  braceR: _braceR,
  parenL: _parenL,
  parenR: _parenR,
  comma: _comma,
  semi: _semi,
  colon: _colon,
  dot: _dot,
  question: _question,
  slash: _slash,
  eq: _eq,
  equality: _equality,
  name: _name,
  eof: _eof,
  num: _num,
  relational: _relational,
  regexp: _regexp,
  string: _string,
  documentationString: _documentationString,
  newline: _newline,
  indent: _indent,
  dedent: _dedent,
  exponentiation: _exponentiation,
  floorDiv: _floorDiv,
  plusMin: _plusMin,
  posNegNot: _posNegNot,
  multiplyModulo: _multiplyModulo
};
for (const kw in keywordTypes) module.exports.tokTypes["_" + kw] = keywordTypes[kw];