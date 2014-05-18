// Filbert: Loose parser
//
// This module provides an alternative parser (`parse_dammit`) that
// exposes that same interface as `parse`, but will try to parse
// anything as Python, repairing syntax errors the best it can.
// There are circumstances in which it will raise an error and give
// up, but they are very rare. The resulting AST will be a mostly
// valid JavaScript AST (as per the [Mozilla parser API][api], except
// that:
//
// - Return outside functions is allowed
//
// - Bogus Identifier nodes with a name of `"✖"` are inserted whenever
//   the parser got too confused to return anything meaningful.
//
// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API
//
// The expected use for this is to *first* try `filbert.parse`, and only
// if that fails switch to `parse_dammit`. The loose parser might
// parse badly indented code incorrectly, so **don't** use it as
// your default parser.
//
// Quite a lot of filbert.js is duplicated here. The alternative was to
// add a *lot* of extra cruft to that file, making it less readable
// and slower. Copying and editing the code allowed invasive changes and 
// simplifications without creating a complicated tangle.

(function(root, mod) {
  if (typeof exports == "object" && typeof module == "object") return mod(exports, require("./filbert")); // CommonJS
  if (typeof define == "function" && define.amd) return define(["exports", "./filbert_loose"], mod); // AMD
  mod(root.filbert_loose || (root.filbert_loose = {}), root.filbert); // Plain browser env
})(this, function(exports, filbert) {
  "use strict";

  var tt = filbert.tokTypes;
  var scope = filbert.scope;
  var indentHist = filbert.indentHist;

  var options, input, inputLen, fetchToken;

  exports.parse_dammit = function(inpt, opts) {
    input = String(inpt); inputLen = input.length;
    setOptions(opts);
    if (!options.tabSize) options.tabSize = 4;
    fetchToken = filbert.tokenize(inpt, options);
    ahead.length = 0;
    newAstIdCount = 0;
    scope.init();
    next();
    return parseTopLevel();
  };

  function setOptions(opts) {
    options = opts || {};
    for (var opt in filbert.defaultOptions) if (!Object.prototype.hasOwnProperty.call(options, opt))
      options[opt] = filbert.defaultOptions[opt];
    sourceFile = options.sourceFile || null;
  }

  var lastEnd, token = {start: 0, end: 0}, ahead = [];
  var lastEndLoc, sourceFile;

  var newAstIdCount = 0;

  function next() {
    lastEnd = token.end;
    if (options.locations) lastEndLoc = token.endLoc;

    if (ahead.length) token = ahead.shift();
    else token = readToken();
  }

  function readToken() {
    for (;;) {
      try {
        return fetchToken();
      } catch(e) {
        if (!(e instanceof SyntaxError)) throw e;

        // Try to skip some text, based on the error message, and then continue
        var msg = e.message, pos = e.raisedAt, replace = true;
        if (/unterminated/i.test(msg)) {
          pos = lineEnd(e.pos);
          if (/string/.test(msg)) {
            replace = {start: e.pos, end: pos, type: tt.string, value: input.slice(e.pos + 1, pos)};
          } else if (/regular expr/i.test(msg)) {
            var re = input.slice(e.pos, pos);
            try { re = new RegExp(re); } catch(e) {}
            replace = {start: e.pos, end: pos, type: tt.regexp, value: re};
          } else {
            replace = false;
          }
        } else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number/i.test(msg)) {
          while (pos < input.length && !isSpace(input.charCodeAt(pos)) && !isNewline(input.charCodeAt(pos))) ++pos;
        } else if (/character escape|expected hexadecimal/i.test(msg)) {
          while (pos < input.length) {
            var ch = input.charCodeAt(pos++);
            if (ch === 34 || ch === 39 || isNewline(ch)) break;
          }
        } else if (/unexpected character/i.test(msg)) {
          pos++;
          replace = false;
        } else if (/regular expression/i.test(msg)) {
          replace = true;
        } else {
          throw e;
        }
        resetTo(pos);
        if (replace === true) replace = {start: pos, end: pos, type: tt.name, value: "✖"};
        if (replace) {
          if (options.locations) {
            replace.startLoc = filbert.getLineInfo(input, replace.start);
            replace.endLoc = filbert.getLineInfo(input, replace.end);
          }
          return replace;
        }
      }
    }
  }

  function resetTo(pos) {
    var ch = input.charAt(pos - 1);
    var reAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) ||
      /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(input.slice(pos - 10, pos));
    fetchToken.jumpTo(pos, reAllowed);
  }

  function copyToken(token) {
    var copy = {start: token.start, end: token.end, type: token.type, value: token.value};
    if (options.locations) {
      copy.startLoc = token.startLoc;
      copy.endLoc = token.endLoc;
    }
    return copy;
  }

  function lookAhead(n) {
    // Copy token objects, because fetchToken will overwrite the one
    // it returns, and in this case we still need it
    if (!ahead.length)
      token = copyToken(token);
    while (n > ahead.length)
      ahead.push(copyToken(readToken()));
    return ahead[n-1];
  }

  var newline = /[\n\r\u2028\u2029]/;
  var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;

  function isNewline(ch) {
    return ch === 10 || ch === 13 || ch === 8232 || ch === 8329;
  }
  
  function isSpace(ch) {
    return ch === 9 || ch === 11 || ch === 12 ||
      ch === 32 || // ' '
      ch === 35 || // '#'
      ch === 160 || // '\xa0'
      ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch));
  }
  
  function lineEnd(pos) {
    while (pos < input.length && !isNewline(input.charCodeAt(pos))) ++pos;
    return pos;
  }

  function skipLine() {
    fetchToken.jumpTo(lineEnd(token.start), false);
  }

  function Node(start) {
    this.type = null;
  }
  Node.prototype = filbert.Node.prototype;

  function SourceLocation(start) {
    this.start = start || token.startLoc || {line: 1, column: 0};
    this.end = null;
    if (sourceFile !== null) this.source = sourceFile;
  }

  function startNode() {
    var node = new Node(token.start);
    if (options.locations)
      node.loc = new SourceLocation();
    if (options.directSourceFile)
      node.sourceFile = options.directSourceFile;
    if (options.ranges)
      node.range = [token.start, 0];
    return node;
  }

  function startNodeFrom(other) {
    var node = new Node(other.start);
    if (options.locations)
      node.loc = new SourceLocation(other.loc.start);
    if (options.ranges)
      node.range = [other.range[0], 0];
    return node;
  }

  function finishNode(node, type) {
    node.type = type;
    if (options.locations)
      node.loc.end = lastEndLoc;
    if (options.ranges)
      node.range[1] = lastEnd;
    return node;
  }

  // Finish a node whose end offset information should be based on
  // the end of another node.  For example, createNode* functions
  // are used to create extra AST nodes which may be based on a single
  // parsed user code node.

  function finishNodeFrom(endNode, node, type) {
    node.type = type;
    if (options.locations) node.loc.end = endNode.loc.end;
    if (options.ranges) node.range[1] = endNode.range[1];
    return node;
  }

  // Create an AST node using start offsets

  // TODO: Isolate extra AST node creation from the parse functions. It's a proper mess.

  function createNodeFrom(startNode, type, props) {
    var node = startNodeFrom(startNode);
    for (var prop in props) node[prop] = props[prop];
    return finishNode(node, type);
  }

  // Create an AST node using start and end offsets

  function createNodeSpan(startNode, endNode, type, props) {
    var node = startNodeFrom(startNode);
    for (var prop in props) node[prop] = props[prop];
    return finishNodeFrom(endNode, node, type);
  }

  // E.g. Math.pow(2, 3)

  function createNodeMemberCall(node, object, property, args) {
    var objId = createNodeFrom(node, "Identifier", { name: object });
    var propId = createNodeFrom(node, "Identifier", { name: property });
    var member = createNodeFrom(node, "MemberExpression", { object: objId, property: propId, computed: false });
    node.callee = member
    node.arguments = args;
    return finishNode(node, "CallExpression");
  }

  // Used to convert 'id = init' to 'var id = init'

  function createVarDeclFromId(refNode, id, init) {
    var decl = startNodeFrom(refNode);
    decl.id = id;
    decl.init = init;
    finishNodeFrom(refNode, decl, "VariableDeclarator");
    var declDecl = startNodeFrom(refNode);
    declDecl.kind = "var";
    declDecl.declarations = [decl];
    return finishNodeFrom(refNode, declDecl, "VariableDeclaration");
  }


  function getDummyLoc() {
    if (options.locations) {
      var loc = new SourceLocation();
      loc.end = loc.start;
      return loc;
    }
  };

  function dummyIdent() {
    var dummy = new Node(token.start);
    dummy.type = "Identifier";
    dummy.end = token.start;
    dummy.name = "✖";
    dummy.loc = getDummyLoc();
    return dummy;
  }
  function isDummy(node) { return node.name == "✖"; }

  function eat(type) {
    if (token.type === type) {
      next();
      return true;
    }
  }

  function expect(type) {
    if (eat(type)) return true;
    if (lookAhead(1).type == type) {
      next(); next();
      return true;
    }
    if (lookAhead(2).type == type) {
      next(); next(); next();
      return true;
    }
  }

  function checkLVal(expr) {
    if (expr.type === "Identifier" || expr.type === "MemberExpression") return expr;
    return dummyIdent();
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
    var varStmts = [];

    // var tmp = right

    var tmpId = createNodeSpan(right, right, "Identifier", { name: "filbertTmp" + newAstIdCount++ });
    var tmpDecl = createVarDeclFromId(right, tmpId, right);
    varStmts.push(tmpDecl)

    // argN = tmp[N]

    if (tupleArgs && tupleArgs.length > 0) {
      for (var i = 0; i < tupleArgs.length; i++) {
        var lval = tupleArgs[i];
        checkLVal(lval);
        var indexId = createNodeSpan(right, right, "Literal", { value: i });
        var init = createNodeSpan(right, right, "MemberExpression", { object: tmpId, property: indexId, computed: true });
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
          finishNode(node, "AssignmentExpression");
          varStmts.push(createNodeFrom(node, "ExpressionStatement", { expression: node }));
        }
      }
    }

    return varStmts;
  }

  // ### Statement parsing

  function parseTopLevel() {
    var node = startNode();
    node.body = [];
    while (token.type !== tt.eof) {
      var stmt = parseStatement();
      if (stmt) node.body.push(stmt);
    }
    return finishNode(node, "Program");
  }

  function parseStatement() {
    var starttype = token.type, node = startNode();

    switch (starttype) {

    case tt._break:
      next();
      return finishNode(node, "BreakStatement");

    case tt._continue:
      next();
      return finishNode(node, "ContinueStatement");

    case tt._class:
      next();
      return parseClass(node);

    case tt._def:
      next();
      return parseFunction(node);

    case tt._for:
      next();
      return parseFor(node);

    case tt._from: // Skipping from and import statements for now
      skipLine();
      next();
      return parseStatement();

    case tt._if: case tt._elif:
      next();
      if (token.type === tt.parenL) node.test = parseParenExpression();
      else node.test = parseExpression();
      expect(tt.colon);
      node.consequent = parseSuite();
      if (token.type === tt._elif)
        node.alternate = parseStatement();
      else
        node.alternate = eat(tt._else) && eat(tt.colon) ? parseSuite() : null;
      return finishNode(node, "IfStatement");

    case tt._import: // Skipping from and import statements for now
      skipLine();
      next();
      return parseStatement();

    case tt.newline:
      // TODO: parseStatement() should probably eat it's own newline
      next();
      return null;

    case tt._pass:
      next();
      return finishNode(node, "EmptyStatement");

    case tt._return:
      next();
      if (token.type === tt.newline || token.type === tt.eof) node.argument = null;
      else { node.argument = parseExpression(); }
      return finishNode(node, "ReturnStatement"); 

    case tt._while:
      next();
      if (token.type === tt.parenL) node.test = parseParenExpression();
      else node.test = parseExpression();
      expect(tt.colon);
      node.body = parseSuite();
      return finishNode(node, "WhileStatement");

    case tt.semi:
      next();
      return finishNode(node, "EmptyStatement");

    case tt.indent:
      // Unexpected indent, let's ignore it
      indentHist.undoIndent();
      next();
      return parseStatement();

    default:
      var expr = parseExpression();
      if (isDummy(expr)) {
        next();
        if (token.type === tt.eof) return finishNode(node, "EmptyStatement");
        return parseStatement();
      } else if (expr.type === "VariableDeclaration" || expr.type === "BlockStatement") {
        return expr;
      } else {
        node.expression = expr;
        return finishNode(node, "ExpressionStatement");
      }
    }
  }

  function parseSuite() {
    var node = startNode();
    node.body = [];
    if (eat(tt.newline)) {
      eat(tt.indent);
      while (!eat(tt.dedent) && !eat(tt.eof)) {
        var stmt = parseStatement();
        if (stmt) node.body.push(stmt);
      }
    } else {
      node.body.push(parseStatement());
      next();
    }
    return finishNode(node, "BlockStatement");
  }

  function parseFor(node) {
    var init = parseExpression(false, true);
    var tupleArgs = getTupleArgs(init);
    if (!tupleArgs) checkLVal(init);
    expect(tt._in);
    var right = parseExpression();
    expect(tt.colon);
    var forOrderedBody = parseSuite();
    var forInBody = JSON.parse(JSON.stringify(forOrderedBody));

    finishNode(node, "BlockStatement");

    var tmpVarSuffix = newAstIdCount++;

    var arrayId = createNodeSpan(node, node, "Identifier", { name: "Array" });
    var lengthId = createNodeSpan(init, init, "Identifier", { name: "length" });
    var zeroLit = createNodeSpan(init, init, "Literal", { value: 0 });

    // var __rightN = right

    var rightId = createNodeSpan(right, right, "Identifier", { name: "filbertRight" + tmpVarSuffix });
    var rightAssign = createVarDeclFromId(right, rightId, right);

    // for(;;) and for(in) loops

    var forRightId = createNodeSpan(init, init, "Identifier", { name: "filbertRight" + tmpVarSuffix });

    // for (var __indexN; __indexN < __rightN.length; ++__indexN)

    var forOrderedIndexId = createNodeSpan(init, init, "Identifier", { name: "filbertIndex" + tmpVarSuffix });
    var forOrderedIndexDeclr = createNodeSpan(init, init, "VariableDeclarator", { id: forOrderedIndexId, init: zeroLit });
    var forOrderedIndexDecln = createNodeSpan(init, init, "VariableDeclaration", { declarations: [forOrderedIndexDeclr], kind: "var" });
    var forOrderedTestMember = createNodeSpan(init, init, "MemberExpression", { object: forRightId, property: lengthId, computed: false });
    var forOrderedTestBinop = createNodeSpan(init, init, "BinaryExpression", { left: forOrderedIndexId, operator: "<", right: forOrderedTestMember });
    var forOrderedUpdate = createNodeSpan(init, init, "UpdateExpression", { operator: "++", prefix: true, argument: forOrderedIndexId });
    var forOrderedMember = createNodeSpan(init, init, "MemberExpression", { object: forRightId, property: forOrderedIndexId, computed: true });

    if (tupleArgs) {
      var varStmts = unpackTuple(true, tupleArgs, forOrderedMember);
      for (var i = varStmts.length - 1; i >= 0; i--) forOrderedBody.body.unshift(varStmts[i]);
    }
    else {
      if (init.type === "Identifier" && !scope.exists(init.name)) {
        scope.addVar(init.name);
        forOrderedBody.body.unshift(createVarDeclFromId(init, init, forOrderedMember));
      } else {
        var forOrderedInit = createNodeSpan(init, init, "AssignmentExpression", { operator: "=", left: init, right: forOrderedMember });
        var forOrderedInitStmt = createNodeSpan(init, init, "ExpressionStatement", { expression: forOrderedInit });
        forOrderedBody.body.unshift(forOrderedInitStmt);
      }
    }

    var forOrdered = createNodeSpan(node, node, "ForStatement", { init: forOrderedIndexDecln, test: forOrderedTestBinop, update: forOrderedUpdate, body: forOrderedBody });
    var forOrderedBlock = createNodeSpan(node, node, "BlockStatement", { body: [forOrdered] });

    // for (init in __rightN)

    var forInLeft = init;
    if (tupleArgs) {
      var varStmts = unpackTuple(true, tupleArgs, right);
      forInLeft = varStmts[0];
      for (var i = varStmts.length - 1; i > 0; i--) forInBody.body.unshift(varStmts[i]);
    }
    else if (init.type === "Identifier" && !scope.exists(init.name)) {
      scope.addVar(init.name);
      forInLeft = createVarDeclFromId(init, init, null);
    }
    var forIn = createNodeSpan(node, node, "ForInStatement", { left: forInLeft, right: forRightId, body: forInBody });
    var forInBlock = createNodeSpan(node, node, "BlockStatement", { body: [forIn] });

    // if ordered sequence then forOrdered else forIn

    var ifRightId = createNodeSpan(node, node, "Identifier", { name: "filbertRight" + tmpVarSuffix });
    var ifTest = createNodeSpan(node, node, "BinaryExpression", { left: ifRightId, operator: "instanceof", right: arrayId });
    var ifStmt = createNodeSpan(node, node, "IfStatement", { test: ifTest, consequent: forOrderedBlock, alternate: forInBlock });

    node.body = [rightAssign, ifStmt];

    return node;
  }

  // ### Expression parsing

  function parseExpression(noComma, noIn) {
    return parseMaybeAssign(noIn);
  }

  function parseParenExpression() {
    expect(tt.parenL);
    var val = parseExpression();
    expect(tt.parenR);
    return val;
  }

  function parseMaybeAssign(noIn) {
    var left = parseMaybeTuple(noIn);
    if (token.type.isAssign) {
      var tupleArgs = getTupleArgs(left);
      if (tupleArgs) {
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
      node.operator = token.value;
      node.left = checkLVal(left);
      next();
      node.right = parseMaybeTuple(noIn);

      if (left.type === "Identifier" && !scope.exists(left.name)) {
        scope.addVar(left.name);
        return createVarDeclFromId(node.left, node.left, node.right);
      }

      return finishNode(node, "AssignmentExpression");
    }
    return left;
  }

  function parseMaybeTuple(noIn) {
    var expr = parseExprOps(noIn);
    if (token.type === tt.comma) {
      return parseTuple(noIn, expr);
    }
    return expr;
  }

  function parseExprOps(noIn) {
    return parseExprOp(parseMaybeUnary(noIn), -1, noIn);
  }

  function parseExprOp(left, minPrec, noIn) {
    var node, exprNode, right, op = token.type, val = token.value;
    var prec = op === tt._not ? tt._in.prec : op.prec;
    if (op === tt.exponentiation && prec >= minPrec) {
      node = startNodeFrom(left);
      next();
      right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
      exprNode = createNodeMemberCall(node, "Math", "pow", [left, right]);
      return parseExprOp(exprNode, minPrec, noIn);
    } else if (prec != null && (!noIn || op !== tt._in)) {
      if (prec > minPrec) {
        next();
        node = startNodeFrom(left);
        if (op === tt.floorDiv) {
          right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
          finishNode(node);
          var binExpr = createNodeSpan(node, node, "BinaryExpression", { left: left, operator: '/', right: right });
          exprNode = createNodeMemberCall(node, "Math", "floor", [binExpr]);
        } else if (op === tt._in || op === tt._not) {
          if (op === tt._in || eat(tt._in)) {
            right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
            finishNode(node);
            var zeroLit = createNodeSpan(node, node, "Literal", { value: 0 });
            var indexOfLit = createNodeSpan(node, node, "Literal", { name: "indexOf" });
            var memberExpr = createNodeSpan(node, node, "MemberExpression", { object: right, property: indexOfLit, computed: false });
            var callExpr = createNodeSpan(node, node, "CallExpression", { callee: memberExpr, arguments: [left] });
            exprNode = createNodeSpan(node, node, "BinaryExpression", { left: callExpr, operator: op === tt._in ? ">=" : "<", right: zeroLit });
          } else exprNode = dummyIdent();
        } else {
          if (op === tt._is) {
            if (eat(tt._not)) node.operator = "!==";
            else node.operator = "===";
          } else node.operator = op.rep != null ? op.rep : val;

          // Accept '===' as '=='
          if (input[token.start - 1] === '=' && input[token.start - 2] === '=') next();

          node.left = left;
          node.right = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
          exprNode = finishNode(node, (op === tt._or || op === tt._and) ? "LogicalExpression" : "BinaryExpression");
        }
        return parseExprOp(exprNode, minPrec, noIn);
      }
    }
    return left;
  }

  function parseMaybeUnary(noIn) {
    if (token.type.prefix || token.type === tt.plusMin) {
      var prec = token.type === tt.plusMin ? tt.posNegNot.prec : token.type.prec;
      var node = startNode();
      node.operator = token.type.rep != null ? token.type.rep : token.value;
      node.prefix = true;
      next();
      node.argument = parseExprOp(parseMaybeUnary(noIn), prec, noIn);
      return finishNode(node, "UnaryExpression");
    }
    return parseExprSubscripts();
  }

  function parseExprSubscripts() {
    return parseSubscripts(parseExprAtom(), false);
  }

  function parseSubscripts(base, noCalls) {
    if (eat(tt.dot)) {
      var node = startNodeFrom(base);
      var id = parseIdent(true);
      if (filbert.pythonRuntime.imports[base.name] && filbert.pythonRuntime.imports[base.name][id.name]) {
        // Calling a Python import function
        var runtimeId = createNodeSpan(base, base, "Identifier", { name: options.runtimeParamName });
        var importsId = createNodeSpan(base, base, "Identifier", { name: "imports" });
        var runtimeMember = createNodeSpan(base, base, "MemberExpression", { object: runtimeId, property: importsId, computed: false });
        node.object = createNodeSpan(base, base, "MemberExpression", { object: runtimeMember, property: base, computed: false });
      } else if (base.name && base.name === scope.getThisReplace()) {
        node.object = createNodeSpan(base, base, "ThisExpression");
      } else node.object = base;
      node.property = id;
      node.computed = false;
      return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
    } else if (eat(tt.bracketL)) {
      var node = startNodeFrom(base);
      node.object = base;
      node.property = parseExpression();
      node.computed = true;
      expect(tt.bracketR);
      return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
    } else if (!noCalls && eat(tt.parenL)) {
      var node = startNodeFrom(base);
      node.arguments = parseExprList(tt.parenR, false);
      if (scope.isNewObj(base.name)) finishNode(node, "NewExpression");
      else finishNode(node, "CallExpression");
      if (filbert.pythonRuntime.functions[base.name]) {
        // Calling a Python built-in function
        var runtimeId = createNodeSpan(base, base, "Identifier", { name: options.runtimeParamName });
        var functionsId = createNodeSpan(base, base, "Identifier", { name: "functions" });
        var runtimeMember = createNodeSpan(base, base, "MemberExpression", { object: runtimeId, property: functionsId, computed: false });
        node.callee = createNodeSpan(base, base, "MemberExpression", { object: runtimeMember, property: base, computed: false });
      } else node.callee = base;
      return parseSubscripts(node, noCalls);
    }
    return base;
  }

  function parseExprAtom() {
    switch (token.type) {

    case tt._dict:
      next();
      return parseDict(tt.parenR);

    case tt.name:
      return parseIdent();

    case tt.num: case tt.string: case tt.regexp:
      var node = startNode();
      node.value = token.value;
      node.raw = input.slice(token.start, token.end);
      next();
      return finishNode(node, "Literal");

    case tt._None: case tt._True: case tt._False:
      var node = startNode();
      node.value = token.type.atomValue;
      node.raw = token.type.keyword;
      next();
      return finishNode(node, "Literal");

    case tt.parenL:
      var tokStartLoc1 = token.startLoc, tokStart1 = token.start;
      next();
      if (token.type === tt.parenR) {
        var node = parseTuple(true);
        eat(tt.parenR);
        return node;
      }
      var val = parseMaybeTuple(true);
      if (options.locations) {
        val.loc.start = tokStartLoc1;
        val.loc.end = token.endLoc;
      }
      if (options.ranges)
        val.range = [tokStart1, token.end];
      expect(tt.parenR);
      return val;

    case tt.bracketL:
      var node = startNode();
      next();
      node.arguments = parseExprList(tt.bracketR, true, false);
      finishNode(node, "NewExpression");
      var runtimeId = createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
      var objectsId = createNodeSpan(node, node, "Identifier", { name: "objects" });
      var runtimeMember = createNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: objectsId, computed: false });
      var listId = createNodeSpan(node, node, "Identifier", { name: "list" });
      node.callee = createNodeSpan(node, node, "MemberExpression", { object: runtimeMember, property: listId, computed: false });
      return node;

    case tt.braceL:
      return parseDict(tt.braceR);

    default:
      return dummyIdent();
    }
  }

  // Parse class

  function parseClass(ctorNode) {
    // Container for class constructor and prototype functions

    var container = startNodeFrom(ctorNode);
    container.body = [];

    // Parse class signature

    ctorNode.id = parseIdent();
    ctorNode.params = [];
    var classParams = [];
    if (eat(tt.parenL)) {
      var first = true;
      while (!eat(tt.parenR)) {
        if (!first) expect(tt.comma); else first = false;
        classParams.push(parseIdent());
      }
    }
    expect(tt.colon);

    // Start new namespace for class body

    scope.startClass(ctorNode.id.name);

    // Save a reference for source ranges

    var classBodyRefNode = finishNode(startNode());

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

    var ctorBlock = startNodeFrom(classBlock);
    ctorBlock.body = [];

    // Add parent class constructor call

    if (classParams.length === 1) {
      var objId = createNodeSpan(classBodyRefNode, classBodyRefNode, "Identifier", { name: classParams[0].name });
      var propertyId = createNodeSpan(classBodyRefNode, classBodyRefNode, "Identifier", { name: "call" });
      var calleeMember = createNodeSpan(classBodyRefNode, classBodyRefNode, "MemberExpression", { object: objId, property: propertyId, computed: false });
      var thisExpr = createNodeSpan(classBodyRefNode, classBodyRefNode, "ThisExpression");
      var callExpr = createNodeSpan(classBodyRefNode, classBodyRefNode, "CallExpression", { callee: calleeMember, arguments: [thisExpr] });
      var superExpr = createNodeSpan(classBodyRefNode, classBodyRefNode, "ExpressionStatement", { expression: callExpr });
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
    finishNode(ctorNode, "FunctionDeclaration");
    container.body.push(ctorNode);

    // Add inheritance via 'MyClass.prototype = Object.create(ParentClass.prototype)'

    if (classParams.length === 1) {
      var childClassId = createNodeSpan(ctorNode, ctorNode, "Identifier", { name: ctorNode.id.name });
      var childPrototypeId = createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "prototype" });
      var childPrototypeMember = createNodeSpan(ctorNode, ctorNode, "MemberExpression", { object: childClassId, property: childPrototypeId, computed: false });
      var parentClassId = createNodeSpan(ctorNode, ctorNode, "Identifier", { name: classParams[0].name });
      var parentPrototypeId = createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "prototype" });
      var parentPrototypeMember = createNodeSpan(ctorNode, ctorNode, "MemberExpression", { object: parentClassId, property: parentPrototypeId, computed: false });
      var objClassId = createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "Object" });
      var objCreateId = createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "create" });
      var objPropertyMember = createNodeSpan(ctorNode, ctorNode, "MemberExpression", { object: objClassId, property: objCreateId, computed: false });
      var callExpr = createNodeSpan(ctorNode, ctorNode, "CallExpression", { callee: objPropertyMember, arguments: [parentPrototypeMember] });
      var assignExpr = createNodeSpan(ctorNode, ctorNode, "AssignmentExpression", { left: childPrototypeMember, operator: "=", right: callExpr });
      var inheritanceExpr = createNodeSpan(ctorNode, ctorNode, "ExpressionStatement", { expression: assignExpr });
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
    while (!eat(tokClose) && !eat(tt.newline) && !eat(tt.eof)) {
      if (!first) {
        expect(tt.comma);
      } else first = false;

      if (tokClose === tt.braceR) {
        key = parsePropertyName();
        expect(tt.colon);
        value = parseExprOps(true);
      } else if (tokClose === tt.parenR) {
        var keyId = parseIdent(true);
        key = startNodeFrom(keyId);
        key.value = keyId.name;
        finishNode(key, "Literal");
        expect(tt.eq);
        value = parseExprOps(true);
      }
      node.arguments.push(createNodeSpan(key, value, "ArrayExpression", { elements: [key, value] }));
    }
    finishNode(node, "NewExpression");

    var runtimeId = createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
    var objectsId = createNodeSpan(node, node, "Identifier", { name: "objects" });
    var runtimeMember = createNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: objectsId, computed: false });
    var listId = createNodeSpan(node, node, "Identifier", { name: "dict" });
    node.callee = createNodeSpan(node, node, "MemberExpression", { object: runtimeMember, property: listId, computed: false });

    return node;
  }

  function parsePropertyName() {
    if (token.type === tt.num || token.type === tt.string) return parseExprAtom();
    if (token.type === tt.name || token.type.keyword) return parseIdent();
  }

  function parseIdent() {
    var node = startNode();
    node.name = token.type === tt.name ? token.value : token.type.keyword;
    next();
    return finishNode(node, "Identifier");
  }

  function parseFunction(node) {
    node.id = parseIdent();
    node.params = [];
    var first = true;
    expect(tt.parenL);
    while (!eat(tt.parenR)) {
      if (!first) expect(tt.comma); else first = false;
      node.params.push(parseIdent());
    }
    expect(tt.colon);

    scope.startFn(node.id.name);

    // If class method, remove class instance var from params and save for 'this' replacement
    if (scope.isParentClass()) {
      var selfId = node.params.shift();
      scope.setThisReplace(selfId.name);
    }

    node.body = parseSuite();

    // If class method, replace with prototype function literals
    var retNode;
    if (scope.isParentClass()) {
      finishNode(node);
      var classId = createNodeSpan(node, node, "Identifier", { name: scope.getParentClassName() });
      var prototypeId = createNodeSpan(node, node, "Identifier", { name: "prototype" });
      var functionId = node.id;
      var prototypeMember = createNodeSpan(node, node, "MemberExpression", { object: classId, property: prototypeId, computed: false });
      var functionMember = createNodeSpan(node, node, "MemberExpression", { object: prototypeMember, property: functionId, computed: false });
      var functionExpr = createNodeSpan(node, node, "FunctionExpression", { body: node.body, params: node.params });
      var assignExpr = createNodeSpan(node, node, "AssignmentExpression", { left: functionMember, operator: "=", right: functionExpr });
      retNode = createNodeSpan(node, node, "ExpressionStatement", { expression: assignExpr });
    } else retNode = finishNode(node, "FunctionDeclaration");

    scope.end();

    return retNode;
  }

  function parseExprList(close) {
    var elts = [];
    while (!eat(close) && !eat(tt.newline) && !eat(tt.eof)) {
      var elt = parseExprOps(true);
      if (isDummy(elt)) {
        next();
      } else {
        elts.push(elt);
      }
      while (eat(tt.comma)) {}
    }
    return elts;
  }

  function parseTuple(noIn, expr) {
    var node = expr ? startNodeFrom(expr) : startNode();
    node.arguments = expr ? [expr] : [];

    // Tuple with single element has special trailing comma: t = 'hi',
    // Look ahead and eat comma in this scenario
    if (token.type === tt.comma) {
      var pos = token.start + 1;
      while (isSpace(input.charCodeAt(pos))) ++pos;
      if (pos >= inputLen || input[pos] === ';' || isNewline(input.charCodeAt(pos))) eat(tt.comma);
    }

    while (eat(tt.comma)) {
      node.arguments.push(parseExprOps(noIn));
    }
    finishNode(node, "NewExpression");

    var runtimeId = createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
    var objectsId = createNodeSpan(node, node, "Identifier", { name: "objects" });
    var runtimeMember = createNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: objectsId, computed: false });
    var listId = createNodeSpan(node, node, "Identifier", { name: "tuple" });
    node.callee = createNodeSpan(node, node, "MemberExpression", { object: runtimeMember, property: listId, computed: false });

    return node;
  }
});
