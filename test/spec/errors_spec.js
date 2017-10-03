var util = require('./util.js');

// NOTE: Be careful with indentation when using multiline strings

describe("Errors", function () {

  xit("Indent error while block", function () {
    // NOTE: Currently supporting empty Suite blocks
    var code = "\
while True:\n\
break\n\
    ";
    var error;
    try {
      util.parse(code);
    } catch (e) {
      error = e;
    }
    expect(error.message).toEqual("Unexpected indent");
    expect(error.pos).toEqual(12);
    expect(error.loc).toEqual({line: 2, column: 0});
  });

  xit("Indent error if block", function () {
    // NOTE: Currently supporting empty Suite blocks
    var code = "\
if True:\n\
x = 5\n\
    ";
    var error;
    try {
      util.parse(code);
    } catch (e) {
      error = e;
    }
    expect(error.message).toBe("Unexpected indent");
    expect(error.pos).toEqual(9);
    expect(error.loc).toEqual({line: 2, column: 0});
  });

  it("Indent error within if block", function () {
    var code = "\
if True:\n\
  x = 5\n\
    x = 5\n\
    ";
    var error;
    try {
      util.parse(code);
    } catch (e) {
      error = e;
    }
    expect(error.message).toBe("Unexpected indent");
    expect(error.pos).toEqual(19);
    expect(error.loc).toEqual({line: 3, column: 2});
  });

  it("else with no colon", function () {
    var code = "\
if False:\n\
  x = 5\n\
else\n\
  x = 7\n\
";
    var error;
    try {
      util.parse(code);
    } catch (e) {
      error = e;
    }
    expect(error.message).toEqual("Unexpected token");
    expect(error.pos).toEqual(22);
    expect(error.loc).toEqual({line: 3, column: 4});
  });

  it("JS-style else if", function () {
    var code = "\
if False:\n\
  x = 5\n\
else if True:\n\
  x = 7\n\
";
    var error;
    try {
      util.parse(code);
    } catch (e) {
      error = e;
    }
    expect(error.message).toEqual("Unexpected token");
    expect(error.pos).toEqual(23);
    expect(error.loc).toEqual({line: 3, column: 5});
  });

});