var util = require('./util.js');

describe("Basics", function () {
  it("return 1000", function () {
    var code = "return 1000";
    expect(util.run(code)).toBe(1000);
  });

  it("simple if", function () {
    var code = "\
    if False: return 2000\n\
    return 1000\n\
    ";
    expect(util.run(code)).toBe(1000);
  });

  it("mathmetics order", function () {
    var code = "\
    return (2*2 + 2/2 - 2*2/2)\n\
    ";
    expect(util.run(code)).toBe(3);
  });

  it("fibonacci function", function () {
    var code = "\
    def fib(n):\n\
      if n < 2: return n\n\
      else: return fib(n - 1) + fib(n - 2)\n\
    chupacabra = fib(6)\n\
    return chupacabra\n\
    ";
    expect(util.run(code)).toBe(8);
  });

  it("for loop", function () {
    var code = "\
    data = [4, 2, 65, 7]\n\
    total = 0\n\
    for d in data:\n\
      total += d\n\
    return total\n\
    ";
    expect(util.run(code)).toBe(78);
  });

  it("bubble sort", function () {
    var code = "\
    import random\n\
    def createShuffled(n):\n\
      r = n * 10 + 1\n\
      shuffle = []\n\
      for i in range(n):\n\
        item = int(r * random.random())\n\
        shuffle.append(item)\n\
      return shuffle\n\
    \n\
    def bubbleSort(data):\n\
      sorted = False\n\
      while not sorted:\n\
        sorted = True\n\
        for i in range(len(data) - 1):\n\
          if data[i] > data[i + 1]:\n\
            t = data[i]\n\
            data[i] = data[i + 1]\n\
            data[i + 1] = t\n\
            sorted = False\n\
      return data\n\
    \n\
    def isSorted(data):\n\
      for i in range(len(data) - 1):\n\
        if data[i] > data[i + 1]:\n\
          return False\n\
      return True\n\
    \n\
    data = createShuffled(10)\n\
    bubbleSort(data)\n\
    return isSorted(data)\n\
    ";
    expect(util.run(code)).toBe(true);
  });

});