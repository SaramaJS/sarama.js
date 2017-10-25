var util = require('./util.js');

describe("JSInterop", function () {

  it("jslist[1]", function () {
    var code = "list[1]";
    expect(util.runInEnv(code, {list: [1,2,3,4]})).toEqual(2);
  });

  it("jslist[-1]", function () {
    var code = "list[-1]";
    expect(util.runInEnv(code, {list: [1,2,3,4]})).toEqual(4);
  });

  it("jslist[-1]", function () {
    var code = 'return "String"[-2]';
    expect(util.run(code)).toEqual('n');
  });

});