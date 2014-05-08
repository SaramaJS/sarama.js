var util = require('./util.js');

describe("Operators", function () {
  it("not 1 or 0", function () {
    var code = "\
    return not 1 or 0\n\
    ";
    expect(util.run(code)).toBe(0);
  });

  it("not 1 < 2 or -4 >= -5", function () {
    var code = "\
    return not 1 < 2 or -4 >= -5\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("not 1 | 0", function () {
    var code = "\
    return not 1 | 0\n\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("3 == -3", function () {
    var code = "\
    return 3 == -3\n\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("-3 != 2", function () {
    var code = "\
    return -3 != 2\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("5 >= -20 or -6 < -10", function () {
    var code = "\
    return 5 >= -20 or -6 < -10\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("5 <= 5 and -6 > -100", function () {
    var code = "\
    return 5 <= 5 and -6 > -100\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("3 in [1, 2, 3]", function () {
    var code = "\
    return 3 in [1, 2, 3]\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("3 not in [1, 2, 3]", function () {
    var code = "\
    return 3 not in [1, 2, 3]\n\
    ";
    expect(util.run(code)).toBe(false);
  });

  it("x not in y == False", function () {
    var code = "\
    x = [1]\n\
    y = [[1]]\n\
    return x not in y == False\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  //it("x == [4, 5]", function () {
  //  var code = "\
  //  x = [4, 5]\n\
  //  return x == [4, 5]\n\
  //  ";
  //  expect(util.run(code)).toBe(true);
  //});

  it("[4, 5] in [1, 2, [4, 5]]", function () {
    var code = "\
    return [4, 5] in [1, 2, [4, 5]]\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("x is y", function () {
    var code = "\
    x = 4\n\
    y = 4\n\
    return x is y\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("x is not y", function () {
    var code = "\
    a = [1, 2, 3]\n\
    x = a\n\
    y = [1, 2, 3]\n\
    return x is not y\n\
    ";
    expect(util.run(code)).toBe(true);
  });

  it("1 ^ 0 & 0", function () {
    var code = "\
    return 1 ^ 0 & 0\n\
    ";
    expect(util.run(code)).toBe(1);
  });

  it("3 << 2 | 5 >> 1", function () {
    var code = "\
    return 3 << 2 | 5 >> 1\n\
    ";
    expect(util.run(code)).toBe(14);
  });

  it("x <<= 2", function () {
    var code = "\
    x = 1\n\
    x <<= 2\n\
    return x\n\
    ";
    expect(util.run(code)).toBe(4);
  });

  it("2 + 3 * 2", function () {
    var code = "\
    return 2 + 3 * 2\n\
    ";
    expect(util.run(code)).toBe(8);
  });

  it("1 + -2", function () {
    var code = "\
    return 1 + -2\n\
    ";
    expect(util.run(code)).toBe(-1);
  });

  it("5 / 2", function () {
    var code = "\
    return 5 / 2\n\
    ";
    expect(util.run(code)).toBe(2.5);
  });

  it("5 // 2", function () {
    var code = "\
    return 5 // 2\n\
    ";
    expect(util.run(code)).toBe(2);
  });

  it("~0 + ~1", function () {
    var code = "\
    return ~0 + ~1\n\
    ";
    expect(util.run(code)).toBe(-3);
  });

  it("3*~-2**2", function () {
    var code = "\
    return 3*~-2**2\n\
    ";
    expect(util.run(code)).toBe(9);
  });

  it("-2**2", function () {
    var code = "\
    return -2**2\n\
    ";
    expect(util.run(code)).toBe(-4);
  });

  it("2**3**2", function () {
    var code = "\
    return 2**3**2\n\
    ";
    expect(util.run(code)).toBe(512);
  });
});