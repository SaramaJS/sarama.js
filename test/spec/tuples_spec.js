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

  it("(1,) + (2,)", function () {
    var code = "\
    return (1,) + (2,)";
    expect(util.run(code)).toEqual([1, 2]);
  });

  it("a += (4, 5)", function () {
    var code = "\
    a = (1, 2, 3)\n\
    a += (4, 5)\n\
    return a";
    expect(util.run(code)).toEqual([1, 2, 3, 4, 5]);
  });

  it("(4, 5) * 2", function () {
    var code = "\
    return (4, 5) * 2";
    expect(util.run(code)).toEqual([4, 5, 4, 5]);
  });

  it("(True,) *= 3", function () {
    var code = "\
    a = (True,)\n\
    a *= 3\n\
    return a";
    expect(util.run(code)).toEqual([true, true, true]);
  });

  it("for ((i,(j, l)),k) in [[[1,[2, 7]],5], [[3,[4, 8]],6]]: ...", function () {
    var code = "\
    total = 0\n\
    for ((i,(j, l)),k) in [[[1,[2, 7]],5], [[3,[4, 8]],6]]:\n\
      total += i + j + k + l\n\
    return total";
    expect(util.run(code)).toEqual(36);
  });

  it("for ((i,i),i) in [[[1,2],5], [[3,4],6]]: ...", function () {
    var code = "\
    total = 0\n\
    for ((i,i),i) in [[[1,2],5], [[3,4],6]]:\n\
      total += i\n\
    return total";
    expect(util.run(code)).toEqual(11);
  });

  it("'a' not in (1, 2, ['a', 4])", function () {
    var code = "\n\
    return 'a' not in (1, 2, ['a', 4])";
    expect(util.run(code)).toEqual(true);
  });

  it("2 in (1, 2, ['a', 4])", function () {
    var code = "\n\
    return 2 in (1, 2, ['a', 4])";
    expect(util.run(code)).toEqual(true);
  });

  it("(1,) in (1, 2, ['a', 4], (1,))", function () {
    var code = "\n\
    return (1,) in (1, 2, ['a', 4], (1,))";
    expect(util.run(code)).toEqual(true);
  });

  it("t[-1]", function () {
    var code = "\n\
    t = (1, 2, 3)\n\
    return t[-1]";
    expect(util.run(code)).toEqual(3);
  });

  it("-23 not in (-23, 45, 'a', False)", function () {
    var code = "\n\
    return -23 not in (-23, 45, 'a', False)";
    expect(util.run(code)).toEqual(false);
  });

  it("Multiline literal", function () {
    var code = "\n\
    return (\n\
      1,\n\
      2,\n\
      3\n\
    )";
    expect(util.run(code)).toEqual([1,2,3]);
  });

});