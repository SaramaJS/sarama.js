var util = require('./util.js');

describe("Runtime library tests", function () {
  it("len('hi')", function () {
    var code = "\
    return len('hi')\
    ";
    expect(util.run(code)).toBe(2);
  });

  it("len([1, 3, 4])", function () {
    var code = "\
    d = [1, 3, 4]\n\
    return len(d)\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("range(3)", function () {
    var code = "\
    return range(3)\n\
    ";
    expect(util.run(code)).toEqual([0, 1, 2]);
  });
  it("range(2, 5)", function () {
    var code = "\
    return range(2, 5)\n\
    ";
    expect(util.run(code)).toEqual([2, 3, 4]);
  });
  it("range(0, 30, 10)", function () {
    var code = "\
    return range(0, 30, 10)\n\
    ";
    expect(util.run(code)).toEqual([0, 10, 20]);
  });
  it("range(0, -5, -1)", function () {
    var code = "\
    return range(0, -5, -1)\n\
    ";
    expect(util.run(code)).toEqual([0, -1, -2, -3, -4]);
  });
  it("range(1, 0)", function () {
    var code = "\
    return range(1, 0)\n\
    ";
    expect(util.run(code)).toEqual([]);
  });

  it("int('5')", function () {
    var code = "\
    return int('5')\n\
    ";
    expect(util.run(code)).toEqual(5);
  });
  it("int('0')", function () {
    var code = "\
    return int('0')\n\
    ";
    expect(util.run(code)).toEqual(0);
  });
  it("int('-5')", function () {
    var code = "\
    return int('-5')\n\
    ";
    expect(util.run(code)).toEqual(-5);
  });
});