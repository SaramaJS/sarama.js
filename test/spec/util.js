var filbert = require('../../filbert.js');
var escodegen = require('escodegen');

exports.run = function (code) {
  try {
    var lines = code.split("\n");
    for (var i in lines) lines[i] = "  " + lines[i];
    var indentedCode = lines.join("\n");
    var wrappedCode = "def foo(" + filbert.defaultOptions.runtimeParamName + "):\n" + indentedCode + "\n";
    var ast = filbert.parse(wrappedCode);
    var js = escodegen.generate(ast);
    js = "(function(__global){__global['foo'] = " + js + "})(this);this.foo(filbert.pythonRuntime);";
    return eval(js);
  }
  catch (e) {
    console.log(e.toString());
    return e;
  }
}