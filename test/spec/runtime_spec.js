var filbert = require('../../filbert.js');
var escodegen = require('escodegen');

function run(code) {
  try {
    var lines = code.split("\n");
    for (var i in lines) lines[i] = "  " + lines[i];
    var indentedCode = lines.join("\n");
    var wrappedCode = "def foo(__pythonRuntime):\n" + indentedCode + "\n";
    var ast = filbert.parse(wrappedCode);
    var js = escodegen.generate(ast);
    js = "(function(__global){__global['foo'] = " + js + "})(this);this.foo(filbert.pythonRuntime);";
    return eval(js);
  }
  catch (e) {
    return e;
  }
}

describe("Runtime library tests", function () {
  it("len('hi')", function () {
    var code = "\
    return len('hi')\
    ";
    expect(run(code)).toBe(2);
  });

  it("len([1, 3, 4])", function () {
    var code = "\
    d = [1, 3, 4]\n\
    return len(d)\n\
    ";
    expect(run(code)).toBe(3);
  });

  it("range(3)", function () {
    var code = "\
    return range(3)\n\
    ";
    expect(run(code)).toEqual([0, 1, 2]);
  });
  it("range(2, 5)", function () {
    var code = "\
    return range(2, 5)\n\
    ";
    expect(run(code)).toEqual([2, 3, 4]);
  });
  it("range(0, 30, 10)", function () {
    var code = "\
    return range(0, 30, 10)\n\
    ";
    expect(run(code)).toEqual([0, 10, 20]);
  });
  it("range(0, -5, -1)", function () {
    var code = "\
    return range(0, -5, -1)\n\
    ";
    expect(run(code)).toEqual([0, -1, -2, -3, -4]);
  });
  it("range(1, 0)", function () {
    var code = "\
    return range(1, 0)\n\
    ";
    expect(run(code)).toEqual([]);
  });

  it("int('5')", function () {
    var code = "\
    return int('5')\n\
    ";
    expect(run(code)).toEqual(5);
  });
  it("int('0')", function () {
    var code = "\
    return int('0')\n\
    ";
    expect(run(code)).toEqual(0);
  });
  it("int('-5')", function () {
    var code = "\
    return int('-5')\n\
    ";
    expect(run(code)).toEqual(-5);
  });
});