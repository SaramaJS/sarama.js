var util = require('./util.js');

describe("Dictionary", function () {
  it("dict(one=1, two=2)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d['two']\n\
    ";
    expect(util.run(code)).toBe(2);
  });

  it("{'p1': 'prop1'}", function () {
    var code = "\
    d = {'p1': 'prop1'}\n\
    return d['p1']\n\
    ";
    expect(util.run(code)).toBe('prop1');
  });

  it("{4: 'prop1'}", function () {
    var code = "\
    d = {4: 'prop1'}\n\
    return d[4]\n\
    ";
    expect(util.run(code)).toBe('prop1');
  });

  it("{p: 'prop1'}", function () {
    var code = "\
    p = 'p1'\n\
    d = {p: 'prop1'}\n\
    return d['p1']\n\
    ";
    expect(util.run(code)).toBe('prop1');
  });

  it("dict(one=1, two=2)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    total = 0\n\
    for key in d:\n\
      total += d[key]\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("len(d)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return len(d)\n\
    ";
    expect(util.run(code)).toBe(2);
  });

  it("clear()", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    d.clear()\n\
    d['foo'] = 'bar'\n\
    return len(d)\n\
    ";
    expect(util.run(code)).toBe(1);
  });

  it("get(key)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.get('one')\n\
    ";
    expect(util.run(code)).toBe(1);
  });

  it("get(key, 'bar')", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.get('foo', 'bar')\n\
    ";
    expect(util.run(code)).toBe('bar');
  });

  it("keys()", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.keys()\n\
    ";
    expect(util.run(code)).toEqual(['one', 'two']);
  });

  it("pop(key)", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    v = d.pop('one')\n\
    if v == 1 and len(d) == 1:\n\
      return True\n\
    return False\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("pop(key, 'bar')", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    v = d.pop('foo', 'bar')\n\
    if v == 'bar' and len(d) == 2:\n\
      return True\n\
    return False\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("values()", function () {
    var code = "\
    d = dict(one=1, two=2)\n\
    return d.values()\n\
    ";
    expect(util.run(code)).toEqual([1, 2]);
  });

  it("'p' in {'p':7}", function () {
    var code = "\
    return 'p' in {'p':7}\n\
    ";
    expect(util.run(code)).toEqual(true);
  });

  it("'p' not in {'p':7}", function () {
    var code = "\
    return 'p' not in {'p':7}\n\
    ";
    expect(util.run(code)).toEqual(false);
  });
});
