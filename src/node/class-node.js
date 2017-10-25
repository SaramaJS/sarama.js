const Node = require('./');

class ClassNode extends Node {
  // Helper to identify class methods which were parsed onto the class prototype
  getPrototype(stmt) {
    if (stmt.expression && stmt.expression.left && stmt.expression.left.object &&
      stmt.expression.left.object.property && stmt.expression.left.object.property.name === "prototype")
      return stmt.expression.left.property.name;
    return null;
  }

  createClass(container, ctorNode, classParams, classBodyRefNode, classBlock) {
    // Add parent class constructor call
    if (classParams.length === 1) {
      var objId = this.createNodeSpan(classBodyRefNode, classBodyRefNode, "Identifier", { name: classParams[0].name });
      var propertyId = this.createNodeSpan(classBodyRefNode, classBodyRefNode, "Identifier", { name: "call" });
      var calleeMember = this.createNodeSpan(classBodyRefNode, classBodyRefNode, "MemberExpression", { object: objId, property: propertyId, computed: false });
      var thisExpr = this.createNodeSpan(classBodyRefNode, classBodyRefNode, "ThisExpression");
      var callExpr = this.createNodeSpan(classBodyRefNode, classBodyRefNode, "CallExpression", { callee: calleeMember, arguments: [thisExpr] });
      var superExpr = this.createNodeSpan(classBodyRefNode, classBodyRefNode, "ExpressionStatement", { expression: callExpr });
      //ctorNode.body.push(superExpr);
    }

    // Add non-function statements and contents of special '__init__' method
    for (var i in classBlock.body) {
      var stmt = classBlock.body[i];
      var prototype = this.getPrototype(stmt);
      if (!prototype) {
        ctorNode.body.push(stmt);
      }
      else if (prototype === "__init__") {
        for (var j in stmt.expression.right.body.body)
          ctorBlock.body.push(stmt.expression.right.body.body[j]);
        ctorNode.params = stmt.expression.right.params;
      }
    }

    // Add inheritance via 'MyClass.prototype = Object.create(ParentClass.prototype)'
    if (classParams.length === 1) {
      var childClassId = this.createNodeSpan(ctorNode, ctorNode, "Identifier", { name: container.id.name });
      var childPrototypeId = this.createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "prototype" });
      var childPrototypeMember = this.createNodeSpan(ctorNode, ctorNode, "MemberExpression", { object: childClassId, property: childPrototypeId, computed: false });
      var parentClassId = this.createNodeSpan(ctorNode, ctorNode, "Identifier", { name: classParams[0].name });
      var parentPrototypeId = this.createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "prototype" });
      var parentPrototypeMember = this.createNodeSpan(ctorNode, ctorNode, "MemberExpression", { object: parentClassId, property: parentPrototypeId, computed: false });
      var objClassId = this.createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "Object" });
      var objCreateId = this.createNodeSpan(ctorNode, ctorNode, "Identifier", { name: "create" });
      var objPropertyMember = this.createNodeSpan(ctorNode, ctorNode, "MemberExpression", { object: objClassId, property: objCreateId, computed: false });
      var callExpr = this.createNodeSpan(ctorNode, ctorNode, "CallExpression", { callee: objPropertyMember, arguments: [parentPrototypeMember] });
      var assignExpr = this.createNodeSpan(ctorNode, ctorNode, "AssignmentExpression", { left: childPrototypeMember, operator: "=", right: callExpr });
      var inheritanceExpr = this.createNodeSpan(ctorNode, ctorNode, "ExpressionStatement", { expression: assignExpr });
      ctorNode.body = inheritanceExpr;
    }

    // Add class methods, which are already prototype assignments

    for (var i in classBlock.body) {
      var stmt = classBlock.body[i];
      var prototype = getPrototype(stmt);
      if (prototype && prototype !== "__init__")
        ctorNode.body.push(stmt);
    }
    // Finish class constructor
    finishNode(ctorNode, "ClassBody");
    return finishNode(container, "ClassDeclaration");
  }
}

module.exports = ClassNode;