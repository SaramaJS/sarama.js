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

describe("Dictionary", function () {
  it("dict(one=1, two=2)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d['two']\n\
    ";
    expect(run(code)).toBe(2);
  });

  it("{'p1': 'prop1'}", function () {
    var code = "\
    d = {'p1': 'prop1'}\n\
    return d['p1']\n\
    ";
    expect(run(code)).toBe('prop1');
  });

  it("{4: 'prop1'}", function () {
    var code = "\
    d = {4: 'prop1'}\n\
    return d[4]\n\
    ";
    expect(run(code)).toBe('prop1');
  });

  it("{p: 'prop1'}", function () {
    var code = "\
    p = 'p1'\n\
    d = {p: 'prop1'}\n\
    return d['p1']\n\
    ";
    expect(run(code)).toBe('prop1');
  });

  it("dict(one=1, two=2)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    total = 0\n\
    for key in d:\n\
      total += d[key]\n\
    return total\n\
    ";
    expect(run(code)).toBe(3);
  });

  it("len(d)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return len(d)\n\
    ";
    expect(run(code)).toBe(2);
  });

  it("clear()", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    d.clear()\n\
    d['foo'] = 'bar'\n\
    return len(d)\n\
    ";
    expect(run(code)).toBe(1);
  });

  it("get(key)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.get('one')\n\
    ";
    expect(run(code)).toBe(1);
  });

  it("get(key, 'bar')", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.get('foo', 'bar')\n\
    ";
    expect(run(code)).toBe('bar');
  });

  it("keys()", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.keys()\n\
    ";
    expect(run(code)).toEqual(['one', 'two']);
  });

  it("pop(key)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    v = d.pop('one')\n\
    if v == 1 and len(d) == 1:\n\
      return True\n\
    return False\n\
    ";
    expect(run(code)).toBe(true);
  });

  it("pop(key, 'bar')", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    v = d.pop('foo', 'bar')\n\
    if v == 'bar' and len(d) == 2:\n\
      return True\n\
    return False\n\
    ";
    expect(run(code)).toBe(true);
  });

  it("values()", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.values()\n\
    ";
    expect(run(code)).toEqual([1, 2]);
  });
});
