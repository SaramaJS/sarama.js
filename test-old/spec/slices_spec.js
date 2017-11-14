var util = require('./util.js');

describe("Slices", function () {
  it("L[0:2]", function () {
    var code = "\n\
    L = [1, 45, 6, -9]\n\
    return L[0:2]";
    expect(util.run(code)).toEqual([1, 45]);
  });

  it("L[2:]", function () {
    var code = "\n\
    L = [1, 45, 6, -9]\n\
    return L[2:]";
    expect(util.run(code)).toEqual([6, -9]);
  });

  it("L[-3:]", function () {
    var code = "\n\
    L = [1, 45, 6, -9]\n\
    return L[-3:]";
    expect(util.run(code)).toEqual([45, 6, -9]);
  });

  it("L[:]", function () {
    var code = "\n\
    L = [0, 1, 2]\n\
    return L[:]";
    expect(util.run(code)).toEqual([0, 1, 2]);
  });

  it("L[1::2]", function () {
    var code = "\n\
    L = [0, 1, 2, 3, 4]\n\
    return L[1::2]";
    expect(util.run(code)).toEqual([1, 3]);
  });

  it("L[::-1]", function () {
    var code = "\n\
    L = [0, 1, 2, 3, 4]\n\
    return L[::-1]";
    expect(util.run(code)).toEqual([4, 3, 2, 1, 0]);
  });

  it("L[::2]", function () {
    var code = "\n\
    L = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]\n\
    return L[::2]";
    expect(util.run(code)).toEqual([0, 2, 4, 6, 8]);
  });

  it("L[f(2)::9 - (2 * 5)]", function () {
    var code = "\n\
    def f(x):\n\
      return x\n\
    L = [0, 1, 2, 3, 4]\n\
    return L[f(2)::9 - (2 * 5)]";
    expect(util.run(code)).toEqual([2, 1, 0]);
  });

  it("T[0:-1:1]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[0:-1:1]";
    expect(util.run(code)).toEqual([0, 1, 2, 3]);
  });

  it("T[1::2]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[::-1]";
    expect(util.run(code)).toEqual([4, 3, 2, 1, 0]);
  });

  it("T[::2]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4, 5, 6, 7, 8, 9)\n\
    return T[::2]";
    expect(util.run(code)).toEqual([0, 2, 4, 6, 8]);
  });

  it("T[-1:-3:-1]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[-1:-3:-1]";
    expect(util.run(code)).toEqual([4, 3]);
  });

  it("T[2::-1]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[2::-1]";
    expect(util.run(code)).toEqual([2, 1, 0]);
  });

  it("T[2:0:-1]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[2:0:-1]";
    expect(util.run(code)).toEqual([2, 1]);
  });

  it("T[2:1:-1]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[2:1:-1]";
    expect(util.run(code)).toEqual([2]);
  });

  it("T[2:-5:-1]", function () {
    var code = "\n\
    T = (0, 1, 2, 3, 4)\n\
    return T[2:-5:-1]";
    expect(util.run(code)).toEqual([2, 1]);
  });

});