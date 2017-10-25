class Scope {
  constructor() {
    this.namespaces = [{ type: 'g', map: {} }];
  }
  current(offset) {
    offset = offset || 0;
    return this.namespaces[this.namespaces.length - offset - 1];
  }
  startClass(id) {
    this.current().map[id] = 'c';
    this.namespaces.push({ type: 'c', map: {}, className: id });
  }
  startFn(id) {
    this.current().map[id] = 'f';
    this.namespaces.push({ type: 'f', map: {}, fnName: id });
  }
  end() { this.namespaces.pop(); }
  addVar(id) { this.current().map[id] = 'v'; }
  exists(id) { return this.current().map.hasOwnProperty(id); }
  isClass() { return this.current().type === 'c'; }
  isUserFunction(name) {
    // Loose match (i.e. order ignored)
    // TODO: does not identify user-defined class methods
    for (var i = this.namespaces.length - 1; i >= 0; i--)
      for (var key in this.namespaces[i].map)
        if (key === name && this.namespaces[i].map[key] === 'f')
          return true;
    return false;
  }
  isParentClass() { return this.current(1).type === 'c'; }
  isNewObj(id) {
    for (var i = this.namespaces.length - 1; i >= 0; i--)
      if (this.namespaces[i].map[id] === 'c') return true;
      else if (this.namespaces[i].map[id] === 'f') break;
    return false;
  }
  getParentClassName() { return this.current(1).className; }
  getThisReplace() { return this.current().thisReplace; }
  setThisReplace(s) { this.current().thisReplace = s; }
};