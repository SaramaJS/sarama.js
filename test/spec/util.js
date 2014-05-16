var filbert = require('../../filbert.js');
var escodegen = require('escodegen');

var parse = exports.parse = function(code, options) {
  return filbert.parse(code, options)
}

exports.run = function (code) {
  try {
    var lines = code.split(/\r\n|[\n\r\u2028\u2029]/g);
    for (var i in lines) lines[i] = "  " + lines[i];
    var indentedCode = lines.join("\n");
    var wrappedCode = "def foo(" + filbert.defaultOptions.runtimeParamName + "):\n" + indentedCode + "\n";
    var ast = parse(wrappedCode);
    var js = escodegen.generate(ast);
    js = "(function(__global){__global['foo'] = " + js + "})(this);this.foo(filbert.pythonRuntime);";
    return eval(js);
  }
  catch (e) {
    //console.log(code + "\n" + e.toString());
    return e;
  }
}