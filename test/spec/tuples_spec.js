var util = require('./util.js');

describe("Tuples", function () {
  it("t = 12345, 54321, 'hello!'", function () {
    var code = "\
    t = 12345, 54321, 'hello!'\n\
    return t[0]";
    expect(util.run(code)).toBe(12345);
  });

  it("t = 4, [1, 2], -5", function () {
    var code = "\
    t = 4, [1, 2], -5\n\
    return t[1]";
    expect(util.run(code)).toEqual([1, 2]);
  });

  it("simple nested", function () {
    var code = "\
    t = 12345, 54321, 'hello!'\n\
    u = t, (1, 2, 3, 4, 5)\n\
    return u[0][1]";
    expect(util.run(code)).toBe(54321);
  });

  it("empty = ()", function () {
    var code = "\
    empty = ()\n\
    return len(empty)";
    expect(util.run(code)).toBe(0);
  });

  it("singleton = 'hello',", function () {
    var code = "\
    singleton = 'hi',\n\
    return singleton[0]";
    expect(util.run(code)).toEqual('hi');
  });

  it("simple unpacking", function () {
    var code = "\
    t = 12345, 54321, 'hello'\n\
    x, y, z = t\n\
    return z";
    expect(util.run(code)).toEqual('hello');
  });

  it("1 in (1, 2, 3)", function () {
    var code = "\
    return 1 in (1, 2, 3)";
    expect(util.run(code)).toEqual(true);
  });

  it("80 not in (1, 2, 3)", function () {
    var code = "\
    return 1 in (1, 2, 3)";
    expect(util.run(code)).toEqual(true);
  });

  it("(x, y, z) = (1, 2, 3)", function () {
    var code = "\
    (x, y, z) = (1, 2, 3)\n\
    return y";
    expect(util.run(code)).toEqual(2);
  });

  it("(x, y, z) = (1, 2, 3)", function () {
    var code = "\
    y = 34\n\
    (x, y, z) = (1, 2, 3)\n\
    return y";
    expect(util.run(code)).toEqual(2);
  });

  it("for k,v, in data", function () {
    var code = "\
    data = dict(one=1, two=2)\n\
    total = 0\n\
    for k, v in data.items():\n\
      total += v\n\
    return total";
    expect(util.run(code)).toEqual(3);
  });

});