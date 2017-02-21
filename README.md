<img src=https://fri.solsort.com/icon.png width=96 height=96 align=right>

[![website](https://img.shields.io/badge/website-fri.solsort.com-blue.svg)](https://fri.solsort.com/)
[![github](https://img.shields.io/badge/github-solsort/fri-blue.svg)](https://github.com/solsort/fri)
[![codeclimate](https://img.shields.io/codeclimate/github/solsort/fri.svg)](https://codeclimate.com/github/solsort/fri)
[![travis](https://img.shields.io/travis/solsort/fri.svg)](https://travis-ci.org/solsort/fri)
[![npm](https://img.shields.io/npm/v/fri.svg)](https://www.npmjs.com/package/fri)

# Functional Reactive Immutable library

This is a utility library intended for [Functional Reactive Programming](https://en.wikipedia.org/wiki/Functional_reactive_programming).

The idea for the library is inspired from experience with [re-frame](https://github.com/Day8/re-frame#readme), and the goal is to have:

- reactions - similar to [reagent](https://reagent-project.github.com/)
- simple immutable JSON datastructure, like [immutable-js](https://facebook.github.io/immutable-js/) but simpler / more lightweight, *and optimised for reagent-like reactions*

**We are not there yet...** The current initial version is just an atomic state, where you can subscribe to changes. **Not functional reactive immutable yet** :( This is the minimal needed for the current applications that I am writing.


## Initialisation

This builds upon [direape](https://direape.solsort.com) for message passing, and unit testing.
    
    var da = require('direape');
    var fri = module.exports; da.testSuite('fri');
    
Use `immutable-js` for the time being, - on then long term, I want to replace this by a more lightweight version, optimised for reactive usage.
    
    var immutable = require('immutable');
    
State, is similar to a single application state atom in clojurescript apps.
    
    var state, dirtyState, stateAccessed; 
    var subscribers, eventSubscribers;
    
## API

### `getJS(path, defaultValue)`
    
    fri.getJS = (path, defaultValue) => {
      path = toPath(path);
      stateAccessed.add(path);
      return toJS(state.getIn(path, defaultValue));
    };
    
    da.test('getJS', () => 
        da.assertEquals(fri.getJS('undefined', 123), 123));
    
### `setJS(path, value)`
    
    fri.setJS = (path, value) => {
      path = toPath(path);
      dirtyState.add(path);
      state = setIn(state, path, value);
      requestUpdate();
    };
    
    da.test('setJS+getJS', () => {
      fri.setJS(['foo', 2, 'bar'], 'hello');
      fri.setJS(['bar'], {quux: 123});
      fri.setJS('baz', 345);
      fri.setJS('qux.bar', 7);
      da.assertEquals(fri.getJS('bar'), {quux: 123});
      da.assertEquals(fri.getJS(['qux', 'bar']), 7);
      da.assertEquals(fri.getJS(['baz']), 345);
      da.assertEquals(fri.getJS(['foo', 2]), {bar: 'hello'});
    });
    
### `rerun(name, fn)`
    
    fri.rerun = (name, fn) => {
      if(fn) {
        stateAccessed.clear();
        var subscriber = { fn: fn };
        updateSubscriber(subscriber);
        subscribers.set(name, subscriber);
      } else {
        subscribers.delete(name);
      }
    };
    
    da.test('rerun', () => new Promise((resolve, reject) => {
      var i = 0;
    
      da.nextTick(() => fri.setJS(['rerun-test'], 123));
      setTimeout(() => fri.setJS(['unaffect'], 789), 200);
      setTimeout(() => fri.setJS(['rerun-test'], 456), 400);
    
      fri.rerun('rerun-test', () => {
        ++i;
        da.assert(i !== 1 || 
            fri.getJS('rerun-test') === undefined);
        da.assert(i !== 2 || 
            fri.getJS('rerun-test') === 123);
        da.assert(i !== 3 || 
            fri.getJS('rerun-test') === 456);
        if(i === 3) {
          resolve();
        }
      });
    }));
    
## Handlers

### `fri:get (path, defaultValue)`
    
    da.handle('fri:get', fri.getJS);
    
### `fri:set (path, value)`
    
    da.handle('fri:set', fri.setJS);
    
### `fri:subscribe (pid, name, path)`
    
    da.handle('fri:subscribe', (pid, name, path) =>
        da.jsonify(fri.rerun(
            `fri:subscribe ${path} -> ${name}@${pid}`,
            () => da.emit(pid, name, path, fri.getJS(path)))));
    
### `fri:unsubscribe (pid, name, path)`
    
    da.handle('fri:unsubscribe', (pid, name, path) =>
        fri.rerun(`fri:subscribe ${path} -> ${name}@${pid}`));
    
### Unit testing
    
    da.test('handle subscribe/unsubscribe', 
        () => new Promise((resolve, reject) => {
          var i = 0;
          da.handle('fri:test:subscribe', (path, data) => {
            ++i;
            try {
              da.assertEquals(path, 'test-sub');
              if(i === 1) {
                da.assertEquals(data, undefined);
              } else if(i === 2) {
                da.assertEquals(data, 'hello'); 
              } else {
                da.assert(false);
              }
            } catch(e) {
              reject(e);
            }
          });
          da.emit(da.pid, 'fri:subscribe', 
              da.pid, 'fri:test:subscribe', 'test-sub');
          setTimeout(() => fri.setJS('test-sub', 'hello'), 100);
          setTimeout(() => da.emit(da.pid, 'fri:unsubscribe', 
                da.pid, 'fri:test:subscribe', 'test-sub'), 150); 
          setTimeout(() => fri.setJS('test-sub', 'arvh'), 200);
          setTimeout(() => { 
            da.assertEquals(i, 2); 
            resolve(); 
          }, 400);
        }));
    
## Implementation details
    
    state = new immutable.Map();
    dirtyState = new Set();
    stateAccessed = new Set();
    subscribers = new Map();
    eventSubscribers = new Map();
    
### requestUpdate
    
    var updateRequested = false;
    var lastUpdate = Date.now();
    
    function requestUpdate() {
      if(!updateRequested) {
        setTimeout(updateSubscribers, 
            Math.max(0, 1000/60 - (Date.now() - lastUpdate)));
        updateRequested = true;
      }
    }
    
### updateSubscribers
    
    function updateSubscribers() {
      lastUpdate = Date.now();
      updateRequested = false;
      var accessMap = new immutable.Map();
      for(var path of dirtyState) {
        accessMap = setIn(accessMap, path, true);
      }
      dirtyState.clear();
    
      for(var subscriber of subscribers.values()) {
        var needsUpdate = false;
        for(path of subscriber.accessed) {
          if(accessMap.getIn(path)) {
            needsUpdate = true;
            break;
          }
        }
        if(needsUpdate) {
          updateSubscriber(subscriber);
        }
      }
    }
    
### updateSubscriber
    
    function updateSubscriber(subscriber) {
      stateAccessed.clear();
      subscriber.fn();
      subscriber.accessed = Array.from(stateAccessed);
    }
    
### setIn
    
    function setIn(o, path, value) {
      if(path.length) {
        var key = path[0];
        var rest = path.slice(1);
        if(!o) {
          if(typeof key === 'number') {
            o = new immutable.List();
          } else {
            o = new immutable.Map();
          }
        }
        return o.set(key, setIn(o.get(path[0]), 
              path.slice(1), value));
      } else {
        return immutable.fromJS(value);
      }
    }
    
### toJS
    
    function toJS(o) {
      if(typeof o === 'object' && o !== null && 
          typeof o.toJS === 'function') {
        o = o.toJS();
      }
      return o;
    }
    
### toPath
    
    function toPath(arr) {
      if(typeof arr === 'string') {
        arr = arr.split('.');
      } else if(!Array.isArray(arr)) {
        arr = [arr];
      }
      return arr;
    }
    
## Main
    if(require.main === module) {
      da.ready(() => 
          da.runTests('fri')
          .then(() => da.isNodeJs() && process.exit(0))
          .catch(() => da.isNodeJs() && process.exit(-1)));
    }
    
