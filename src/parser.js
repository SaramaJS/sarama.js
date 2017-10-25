// ## Parser

// A recursive descent parser operates by defining functions for all
// syntactic elements, and recursively calling those, each function
// advancing the input stream and returning an AST node. Precedence
// of constructs (for example, the fact that `!x[1]` means `!(x[1])`
// instead of `(!x)[1]` is handled by the fact that the parser
// function that parses unary prefix operators is called first, and
// in turn calls the function that parses `[]` subscripts - that
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
}

exports.Node = Node;
