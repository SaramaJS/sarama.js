var filbert = require('../../filbert.js');
var filbert_loose = require('../../filbert_loose.js');
var escodegen = require('escodegen');

var parse = exports.parse = function(code, options) {
  // Swap returns for low tech testing of filbert_loose
  return filbert.parse(code, options)
  //return filbert_loose.parse_dammit(code, options)
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

exports.runInEnv = function (code, env) {
    var lines = code.split(/\r\n|[\n\r\u2028\u2029]/g);
    for (var i in lines) lines[i] = "  " + lines[i];
    var indentedCode = lines.join("\n");
    var fbody = parse(code)
    var code = escodegen.generate(fbody).split(/\n/)
    for ( var idx in env ) {
      code.unshift('var ' + idx + ' = ' + JSON.stringify(env[idx]) + ';' );
    }
    code[code.length - 1] = "return " + code[code.length - 1];
    var fxn = new Function(filbert.defaultOptions.runtimeParamName, code.join('\n'));
    return fxn.call(null, filbert.pythonRuntime);
}