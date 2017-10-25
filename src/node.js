class Node {

  // Finish a node whose end offset information should be based on
  // the end of another node.  For example, createNode* functions
  // are used to create extra AST nodes which may be based on a single
  // parsed user code node.

  finishNodeFrom(endNode, node, type) {
    node.type = type;
    if (options.locations) node.loc.end = endNode.loc.end;
    if (options.ranges) node.range[1] = endNode.range[1];
    return node;
  }

  // Create an AST node using start offsets

  createNodeFrom(startNode, type, props) {
    var node = startNodeFrom(startNode);
    for (var prop in props) node[prop] = props[prop];
    return finishNode(node, type);
  }

  // Create an AST node using start and end offsets

  createNodeSpan(startNode, endNode, type, props) {
    var node = startNodeFrom(startNode);
    for (var prop in props) node[prop] = props[prop];
    return this.finishNodeFrom(endNode, node, type);
  }

  createGeneratedNodeSpan(startNode, endNode, type, props) {
    var node = startNodeFrom(startNode);
    for (var prop in props) node[prop] = props[prop];
    node.userCode = false;
    return this.finishNodeFrom(endNode, node, type);
  }

  // while (__formalsIndex < __params.formals.length) {
  //   <argsId>.push(__params.formals[__formalsIndex++]); }
  createNodeArgsWhileConsequent(argsId, s) {
    var __realArgCountId  = this.createGeneratedNodeSpan(argsId, argsId, "Identifier", { name:  '__realArgCount' + s });
    var __paramsFormals  = this.createGeneratedNodeSpan(argsId, argsId, "Identifier", { name:  'arguments' });
    var __formalsIndexId = this.createGeneratedNodeSpan(argsId, argsId, "Identifier", { name: '__formalsIndex' + s });
    return this.createGeneratedNodeSpan(argsId, argsId, "WhileStatement", {
      test: this.createGeneratedNodeSpan(argsId, argsId, "BinaryExpression", {
        operator: '<', left: __formalsIndexId,
        right: __realArgCountId
      }),
      body: this.createGeneratedNodeSpan(argsId, argsId, "BlockStatement", {
        body: [this.createGeneratedNodeSpan(argsId, argsId, "ExpressionStatement", {
          expression: this.createGeneratedNodeSpan(argsId, argsId, "CallExpression", {
            callee: this.createNodeMembIds(argsId, argsId.name, 'push'),
            arguments: [this.createGeneratedNodeSpan(argsId, argsId, "MemberExpression", {
              computed: true, object: __paramsFormals,
              property: this.createGeneratedNodeSpan(argsId, argsId, "UpdateExpression", {
                operator: '++', prefix: false, argument: __formalsIndexId
              })
            })]
          })
        })]
      })
    });
  },

  // { while (__formalsIndex < __args.length) {
  //   <argsId>.push(__args[__formalsIndex++]); }}
  createNodeArgsAlternate(argsId, s) {
    var __args = '__args' + s;
    var __formalsIndexId = this.createGeneratedNodeSpan(argsId, argsId, "Identifier", { name: '__formalsIndex' + s });
    return this.createGeneratedNodeSpan(argsId, argsId, "BlockStatement", {
      body: [this.createGeneratedNodeSpan(argsId, argsId, "WhileStatement", {
        test: this.createGeneratedNodeSpan(argsId, argsId, "BinaryExpression", {
          operator: '<', left: __formalsIndexId,
          right: this.createNodeMembIds(argsId, __args, 'length')
        }),
        body: this.createGeneratedNodeSpan(argsId, argsId, "BlockStatement", {
          body: [this.createGeneratedNodeSpan(argsId, argsId, "ExpressionStatement", {
            expression: this.createGeneratedNodeSpan(argsId, argsId, "CallExpression", {
              callee: this.createNodeMembIds(argsId, argsId.name, 'push'),
              arguments: [this.createGeneratedNodeSpan(argsId, argsId, "MemberExpression", {
                computed: true,
                object: this.createGeneratedNodeSpan(argsId, argsId, "Identifier", { name: __args }),
                property: this.createGeneratedNodeSpan(argsId, argsId, "UpdateExpression", {
                  operator: '++', prefix: false, argument: __formalsIndexId
                })
              })]
            })
          })]
        })
      })]
    });
  }

  // return (function() {<body>}).call(this);
  createNodeFnBodyIife(body) {
    var iifeBody = this.createGeneratedNodeSpan(body, body, "FunctionExpression", {
      params: [], defaults: [], body: body, generator: false, expression: false
    });
    var iifeCall = this.createGeneratedNodeSpan(body, body, "CallExpression", {
      callee: this.createGeneratedNodeSpan(body, body, "MemberExpression", {
        computed: false, object: iifeBody,
        property: this.createGeneratedNodeSpan(body, body, "Identifier", { name: 'call' })
      }),
      arguments: [this.createGeneratedNodeSpan(body, body, "ThisExpression")]
    });
    return this.createGeneratedNodeSpan(body, body, "ReturnStatement", { argument: iifeCall });
  }

  // E.g. Math.pow(2, 3)

  createNodeMemberCall(node, object, property, args) {
    var objId = this.createNodeFrom(node, "Identifier", { name: object });
    var propId = this.createNodeFrom(node, "Identifier", { name: property });
    var member = this.createNodeFrom(node, "MemberExpression", { object: objId, property: propId, computed: false });
    node.callee = member;
    node.arguments = args;
    return finishNode(node, "CallExpression");
  }

  // o.p
  createNodeMembIds(r, o, p) {
    return this.createNodeSpan(r, r, "MemberExpression", {
      computed: false,
      object: this.createNodeSpan(r, r, "Identifier", { name: o }),
      property: this.createNodeSpan(r, r, "Identifier", { name: p })
    })
  }

  // o[p]
  createNodeMembIdLit(r, o, p) {
    return this.createNodeSpan(r, r, "MemberExpression", {
      computed: true,
      object: this.createNodeSpan(r, r, "Identifier", { name: o }),
      property: this.createNodeSpan(r, r, "Literal", { value: p })
    })
  }

  // E.g. pyRuntime.ops.add

  createNodeOpsCallee(node, fnName) {
    var runtimeId = this.createGeneratedNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
    var opsId = this.createGeneratedNodeSpan(node, node, "Identifier", { name: "ops" });
    var addId = this.createGeneratedNodeSpan(node, node, "Identifier", { name: fnName });
    var opsMember = this.createGeneratedNodeSpan(node, node, "MemberExpression", { object: runtimeId, property: opsId, computed: false });
    return this.createGeneratedNodeSpan(node, node, "MemberExpression", { object: opsMember, property: addId, computed: false });
  }

  // var __params = arguments.length === 1 && arguments[0].formals && arguments[0].keywords ? arguments[0] : null;
  createNodeParamsCheck(r, s) {
    var __paramsId = this.createNodeSpan(r, r, "Identifier", { name: '__params' + s });
    var arguments0 = this.createNodeMembIdLit(r, 'arguments', 0);
    var checks = this.createNodeSpan(r, r, "ConditionalExpression", {
      test: this.createNodeSpan(r, r, "LogicalExpression", {
        operator: '&&',
        left: this.createNodeSpan(r, r, "LogicalExpression", {
          operator: '&&',
          left: this.createNodeSpan(r, r, "BinaryExpression", {
            operator: '===',
            left: this.createNodeMembIds(r, 'arguments', 'length'),
            right: this.createNodeSpan(r, r, "Literal", { value: 1 })
          }),
          right: this.createNodeSpan(r, r, "MemberExpression", {
            computed: false, object: arguments0,
            property: this.createNodeSpan(r, r, "Identifier", { name: 'formals' }),
          })
        }),
        right: this.createNodeSpan(r, r, "MemberExpression", {
          computed: false, object: arguments0,
          property: this.createNodeSpan(r, r, "Identifier", { name: 'keywords' }),
        })
      }),
      consequent: arguments0,
      alternate: this.createNodeSpan(r, r, "Literal", { value: null })
    });
    return this.createGeneratedVarDeclFromId(r, __paramsId, checks);
  }

  // E.g. pyRuntime.utils.add

  createNodeRuntimeCall(r, mod, fn, args) {
    return this.createNodeSpan(r, r, "CallExpression", {
      callee: this.createNodeSpan(r, r, "MemberExpression", {
        computed: false,
        object: this.createNodeMembIds(r, options.runtimeParamName,  mod),
        property: this.createNodeSpan(r, r, "Identifier", { name: fn })
      }),
      arguments: args
    });
  }

  // Used to convert 'id = init' to 'var id = init'

  createVarDeclFromId(refNode, id, init) {
    var decl = startNodeFrom(refNode);
    decl.id = id;
    decl.init = init;
    this.finishNodeFrom(refNode, decl, "VariableDeclarator");
    var declDecl = startNodeFrom(refNode);
    declDecl.kind = "var";
    declDecl.declarations = [decl];
    return this.finishNodeFrom(refNode, declDecl, "VariableDeclaration");
  }

  createGeneratedVarDeclFromId(refNode, id, init) {
    var decl = startNodeFrom(refNode);
    decl.id = id;
    decl.init = init;
    this.finishNodeFrom(refNode, decl, "VariableDeclarator");
    var declDecl = startNodeFrom(refNode);
    declDecl.kind = "var";
    declDecl.declarations = [decl];
    declDecl.userCode = false;
    return this.finishNodeFrom(refNode, declDecl, "VariableDeclaration");
  }



  // Create for loop
  //
  // Problem:
  // 1. JavaScript for/in loop iterates on properties, which are the indexes for an Array
  //    Python iterates on the list items themselves, not indexes
  // 2. JavaScript for/in does not necessarily iterate in order
  // Solution:
  // Generate extra AST to do the right thing at runtime
  // JavaScript for/in is used for dictionaries
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

  // TODO: for/in on a string should go through items, not indexes. String obj and string literal.

  createFor(node, init, tupleArgs, right, body) {
    var forOrderedBody = body;
    var forInBody = JSON.parse(JSON.stringify(forOrderedBody));

    var tmpVarSuffix = newAstIdCount++;

    var arrayId = this.createNodeSpan(node, node, "Identifier", { name: "Array" });
    var lengthId = this.createNodeSpan(init, init, "Identifier", { name: "length" });
    var zeroLit = this.createNodeSpan(init, init, "Literal", { value: 0 });

    // var __rightN = right

    var rightId = this.createNodeSpan(right, right, "Identifier", { name: "__filbertRight" + tmpVarSuffix });
    var rightAssign = this.createVarDeclFromId(right, rightId, right);

    // for(;;) and for(in) loops

    var forRightId = this.createNodeSpan(init, init, "Identifier", { name: "__filbertRight" + tmpVarSuffix });

    // for (var __indexN; __indexN < __rightN.length; ++__indexN)

    var forOrderedIndexId = this.createNodeSpan(init, init, "Identifier", { name: "__filbertIndex" + tmpVarSuffix });
    var forOrderedIndexDeclr = this.createNodeSpan(init, init, "VariableDeclarator", { id: forOrderedIndexId, init: zeroLit });
    var forOrderedIndexDecln = this.createNodeSpan(init, init, "VariableDeclaration", { declarations: [forOrderedIndexDeclr], kind: "var" });
    var forOrderedTestMember = this.createNodeSpan(init, init, "MemberExpression", { object: forRightId, property: lengthId, computed: false });
    var forOrderedTestBinop = this.createNodeSpan(init, init, "BinaryExpression", { left: forOrderedIndexId, operator: "<", right: forOrderedTestMember });
    var forOrderedUpdate = this.createNodeSpan(init, init, "UpdateExpression", { operator: "++", prefix: true, argument: forOrderedIndexId });
    var forOrderedMember = this.createNodeSpan(init, init, "MemberExpression", { object: forRightId, property: forOrderedIndexId, computed: true });

    if (tupleArgs) {
      var varStmts = unpackTuple(tupleArgs, forOrderedMember);
      for (var i = varStmts.length - 1; i >= 0; i--) forOrderedBody.body.unshift(varStmts[i]);
    }
    else {
      if (init.type === "Identifier" && !scope.exists(init.name)) {
        scope.addVar(init.name);
        forOrderedBody.body.unshift(this.createVarDeclFromId(init, init, forOrderedMember));
      } else {
        var forOrderedInit = this.createNodeSpan(init, init, "AssignmentExpression", { operator: "=", left: init, right: forOrderedMember });
        var forOrderedInitStmt = this.createNodeSpan(init, init, "ExpressionStatement", { expression: forOrderedInit });
        forOrderedBody.body.unshift(forOrderedInitStmt);
      }
    }

    var forOrdered = this.createNodeSpan(node, node, "ForStatement", { init: forOrderedIndexDecln, test: forOrderedTestBinop, update: forOrderedUpdate, body: forOrderedBody });
    var forOrderedBlock = this.createNodeSpan(node, node, "BlockStatement", { body: [forOrdered] });

    // for (init in __rightN)

    var forInLeft = init;
    if (tupleArgs) {
      var varStmts = unpackTuple(tupleArgs, right);
      forInLeft = varStmts[0];
      for (var i = varStmts.length - 1; i > 0; i--) forInBody.body.unshift(varStmts[i]);
    }
    else if (init.type === "Identifier" && !scope.exists(init.name)) {
      scope.addVar(init.name);
      forInLeft = this.createVarDeclFromId(init, init, null);
    }
    var forIn = this.createNodeSpan(node, node, "ForInStatement", { left: forInLeft, right: forRightId, body: forInBody });
    var forInBlock = this.createNodeSpan(node, node, "BlockStatement", { body: [forIn] });

    // if ordered sequence then forOrdered else forIn

    var ifRightId = this.createNodeSpan(node, node, "Identifier", { name: "__filbertRight" + tmpVarSuffix });
    var ifTest = this.createNodeSpan(node, node, "BinaryExpression", { left: ifRightId, operator: "instanceof", right: arrayId });
    var ifStmt = this.createNodeSpan(node, node, "IfStatement", { test: ifTest, consequent: forOrderedBlock, alternate: forInBlock });

    node.body = [rightAssign, ifStmt];

    return node;
  }

  // expr => __tmpList.push(expr);

  createListCompPush(expr, tmpVarSuffix) {
    var exprPushTmpListId = this.createNodeSpan(expr, expr, "Identifier", { name: "__tmpList" + tmpVarSuffix });
    var exprPushId = this.createNodeSpan(expr, expr, "Identifier", { name: "push" });
    var exprMember = this.createNodeSpan(expr, expr, "MemberExpression", { object: exprPushTmpListId, property: exprPushId, computed: false });
    var exprCall = this.createNodeSpan(expr, expr, "CallExpression", { callee: exprMember, arguments: [expr] });
    return this.createNodeSpan(expr, expr, "ExpressionStatement", { expression: exprCall });
  }

  //  (function() {
  //    var _list = [];
  //    ...
  //    body
  //    return _list;
  //  }());

  createListCompIife(node, body, tmpVarSuffix) {
    var iifeRuntimeId = this.createNodeSpan(node, node, "Identifier", { name: options.runtimeParamName });
    var iifeObjectsId = this.createNodeSpan(node, node, "Identifier", { name: "objects" });
    var iifeObjMember = this.createNodeSpan(node, node, "MemberExpression", { object: iifeRuntimeId, property: iifeObjectsId, computed: false });
    var iifeListId = this.createNodeSpan(node, node, "Identifier", { name: "list" });
    var iifeListMember = this.createNodeSpan(node, node, "MemberExpression", { object: iifeObjMember, property: iifeListId, computed: false });
    var iifeNewExpr = this.createNodeSpan(node, node, "NewExpression", { callee: iifeListMember, arguments: [] });
    var iifeListId = this.createNodeSpan(node, node, "Identifier", { name: "__tmpList" + tmpVarSuffix });
    var iifeListDecl = this.createVarDeclFromId(node, iifeListId, iifeNewExpr);

    var iifeReturnListId = this.createNodeSpan(node, node, "Identifier", { name: "__tmpList" + tmpVarSuffix });
    var iifeReturn = this.createNodeSpan(node, node, "ReturnStatement", { argument: iifeReturnListId });

    var iifeBlock = this.createNodeSpan(node, node, "BlockStatement", { body: [iifeListDecl, body, iifeReturn] });
    var fnExpr = this.createNodeSpan(node, node, "FunctionExpression", { params: [], defaults: [], body: iifeBlock, generator: false, expression: false, computed: false });

    return this.createNodeSpan(node, node, "CallExpression", { callee: fnExpr, arguments: [] });
  }
}