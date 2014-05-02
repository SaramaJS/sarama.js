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

describe("Operators", function () {
  it("not 1 or 0", function () {
    var code = "\
    return not 1 or 0\n\
    ";
    expect(run(code)).toBe(0);
  });

  it("not 1 < 2 or -4 >= -5", function () {
    var code = "\
    return not 1 < 2 or -4 >= -5\n\
    ";
    expect(run(code)).toBe(true);
  });

  it("not 1 | 0", function () {
    var code = "\
    return not 1 | 0\n\
    ";
    expect(run(code)).toBe(false);
  });

  it("3 == -3", function () {
    var code = "\
    return 3 == -3\n\
    ";
    expect(run(code)).toBe(false);
  });

  it("-3 != 2", function () {
    var code = "\
    return -3 != 2\n\
    ";
    expect(run(code)).toBe(true);
  });

  it("5 >= -20 or -6 < -10", function () {
    var code = "\
    return 5 >= -20 or -6 < -10\n\
    ";
    expect(run(code)).toBe(true);
  });

  it("5 <= 5 and -6 > -100", function () {
    var code = "\
    return 5 <= 5 and -6 > -100\n\
    ";
    expect(run(code)).toBe(true);
  });

  it("1 ^ 0 & 0", function () {
    var code = "\
    return 1 ^ 0 & 0\n\
    ";
    expect(run(code)).toBe(1);
  });

  it("3 << 2 | 5 >> 1", function () {
    var code = "\
    return 3 << 2 | 5 >> 1\n\
    ";
    expect(run(code)).toBe(14);
  });

  it("x <<= 2", function () {
    var code = "\
    x = 1\n\
    x <<= 2\n\
    return x\n\
    ";
    expect(run(code)).toBe(4);
  });

  it("2 + 3 * 2", function () {
    var code = "\
    return 2 + 3 * 2\n\
    ";
    expect(run(code)).toBe(8);
  });

  it("1 + -2", function () {
    var code = "\
    return 1 + -2\n\
    ";
    expect(run(code)).toBe(-1);
  });

  it("5 / 2", function () {
    var code = "\
    return 5 / 2\n\
    ";
    expect(run(code)).toBe(2.5);
  });

  it("5 // 2", function () {
    var code = "\
    return 5 // 2\n\
    ";
    expect(run(code)).toBe(2);
  });

  it("~0 + ~1", function () {
    var code = "\
    return ~0 + ~1\n\
    ";
    expect(run(code)).toBe(-3);
  });

  it("3*~-2**2", function () {
    var code = "\
    return 3*~-2**2\n\
    ";
    expect(run(code)).toBe(9);
  });

  it("-2**2", function () {
    var code = "\
    return -2**2\n\
    ";
    expect(run(code)).toBe(-4);
  });

  it("2**3**2", function () {
    var code = "\
    return 2**3**2\n\
    ";
    expect(run(code)).toBe(512);
  });
});