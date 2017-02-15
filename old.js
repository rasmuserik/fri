// # Functional Reactive Immutable data
//
//
var da = require('direape');
da.testSuite('fri');
var fri = {};

// ## Reactive State
//
// ### `setState(o)`

fri.setState = (o) => {
  return source.update(o);
};

// ### `getState()`

fri.getState = () => {
  return source.value();
};

// ### `reaction(f, params)` returns reaction, which when called returns result

fri.reaction = function(fn) {
  return new Reaction(fn, da.slice(arguments, 1));
};

// ### `rerun(name, reaction)`

fri.rerun = (name, reaction) => {
  drains.set(name, reaction);
  dirtyReactions.add(sink);
  scheduleReactions();
};

// ### `Reaction`

var runningReaction;

var reactionCounter = 0;
var dirtyReactions = new Set();
var reactionsScheduled = false;

// ### scheduleReactions()

function scheduleReactions() {
  if(!reactionsScheduled) {
    reactionsScheduled = true;
    setTimeout(runReactions, 0);
  }
}

// ### runReactions()

function runReactions() {
  reactionsScheduled = false;
  while(dirtyReactions.size) {
    var reactions = Array.from(dirtyReactions);
    dirtyReactions.clear();
    for(var i = 0; i < reactions.length; ++i) {
      reactions[i].update();
    }
  }
}

// ### new Reaction(fn)

function Reaction(fn, args) {
  this.fn = fn;
  this.args = args;
  this.valueCounter = 0;
  this.counter = 0;
  this.inputs = new Set();
  this.outputs = new Set();
}

// ### Reaction.value()

Reaction.prototype.value = function() {
  if(runningReaction) {
    runningReaction.inputs.add(this);
  }

  if(!this.outputs.size) {
    var needsUpdate = !this.counter;
    for(var input of this.inputs) {
      if(input.valueCounter > this.counter) {
        needsUpdate = true;
      }
    }
    if(needsUpdate) {
      this.update();
    }
  }
  return this.val;
};

// ### Reaction.update()

Reaction.prototype.update = function() {
  var prevReaction = runningReaction;
  runningReaction = this;

  if(this.outputs.size) {
    for(var input of this.inputs) {
      input.outputs.delete(this);
    }
  }
  this.inputs.clear();

  var value = this.fn.apply(this, this.args);
  this.counter = ++reactionCounter;
  if(!da.equals(value, this.val)) {
    this.valueCounter = this.counter;
  }

  runningReaction = undefined;
  if(this.outputs.size) {
    for(input of this.inputs) {
      input.outputs.add(this);
    }
    for(var output of this.outputs) {
      if(!output.outputs.size) {
        this.outputs.delete(output);
      } 
      dirtyReactions.add(output);
    }
  }

  runningReaction = prevReaction;
};

// ### source

var source = new Reaction();

source.value = function() {
  if(runningReaction) {
    runningReaction.inputs.add(this);
  }
  return this.val;
};
source.update = function(val) {
  if(arguments.length === 1 && !da.equals(val, this.val)) {
    this.val = val;
    this.valueCounter = this.counter = ++reactionCounter;
    for(var output of this.outputs) {
      dirtyReactions.add(output);
    }
    scheduleReactions();
  }
};

// ### drain
var drains = new Map();

var sink = new Reaction(o => {
  for(var reaction of drains.values()) {
    if(reaction && reaction.value) {
      reaction.value();
    }
  }
});
sink.id = 'sink';

var drain = new Reaction();
drain.id = 'drain';
sink.outputs.add(drain);
drain.outputs.add(drain);
drain.update = () => undefined;
drain.value = () => undefined;
sink.update();

// ### Implementation details
// - dag, from a single source-input-reaction to a single drain-output-reaction.
//
// Reaction:
//
// - data
//     - uid
//     - exec-count (only increases when result changes)
//     - fn
//     - parameters
//     - result
//     - list of inputs (reactions accessed) from previous run, and their exec-count
//     - list of outputs (who have output as (grand-)child)
//  - code
//     - update children(recursively) on change
//     - get value (traverse undrained parents if no drain, and recalculate if needed)
//
// ## TODO Immutable "Array"
//
// ## TODO Immutable "Object"
//
// ## TODO Reactive JSON Objects
// ## Main
if(require.main === module) {
  da.ready(() => da.nextTick(() => {

    da.runTests('fri');
    console.log('n');
    var r = fri.reaction(function r() { console.log('r', fri.getState())});
    r.id = 'r';
    fri.rerun('hi', r);
    sink.update();
    console.log(r);
    fri.setState(1);
    setTimeout(() => fri.setState(5), 100);
    /*
    r.update();
    console.log(r);
    */
  }));
}


// # Old
// ## REUN - require(unpkg)
//
/*
//
// Reun is:
//
// - 100% client-side nodejs-like `require` for the browser.
// - using https://unpkg.com/.
// - dynamic, just `require(...)` whatever module you want from your source file. No need for `package.json`, - versions can be passed to require, i.e. `require('module@1.2.3')`.
// - pretending to be a synchronous, even though it is asynchrounous. Tries to work in the typical cases, and will always fail in certain documented edge cases. Pragmatic, and not standard compliant.
// - able to directly load many nodejs modules, that has not been packaged for the browser.
// - adding custom functionality when desired, i.e. `module.meta`
//
// ### API
//
// - `reun.run(code, [opt])` execute `code`, where `code` is either a function, or the string source of a module. `require()` is available and is pretending to be synchronous, and done relative to the `opt.uri`. Returns a promise of the function result or module-exports.
// - `reun.require(module)` loads a module, path is relative to the `location.href` if available. Returns a promise.
//
// ### Usage example
//
// `index.html`:
// ```html
// <!DOCTYPE html>
// <html>
//   <body>
//     <script src=https://unpkg.com/reun></script>
//     <script>reun.require('./example.js');</script>
//   </body>
// </html>
// ```
//
// `example.js`:
// ```javascript
// var uniq = require('uniq');
// console.log(uniq([1,4,2,8,4,2,1,3,2]));
// ```
//
// ### Extensions
//
// - `require('module@0.2.3')` allows you to require a specific version
// - `module.meta` allows you to set meta information about your module, - this may later be used to automatically package the module for npm, cordova, ...
//
// ### Incompatibilities
//
// The implementation is a hack. We want to _pretend_ to be synchronous, but we also do not want to block the main thread. Instead `require` throws an exception when a module is not loaded yet. When we run a file, we catch this exception, load the module asynchrounously, and then rerun the file. Later on we might also search the source for `require("...")`, or `require('...')` and try to preload these modules, but this is not implemented yet.
//
// Also we just resolve the module name as `'https://unpkg.com/' + module_name`. To be more compatible with node modules, we may check the `package.json` in the future to make sure that the relative paths in the require works.
//
// - Custom exceptions from `require` should not caught.
// - Code before a require, may be executed multiple times, - should be side-effect free.
// - `require` may fail within callbacks, if the module has not been loaded before.
// - If the source lives in a subdirectory, and the module is not packaged for the web, and contains relative paths, - the paths are wrongly resolved. A workaround is to `require('module/lib/index.js')` instead of `require('module')`.
// - It does obviously not work with every module.
//
// In spite of these limitations, it is still possible to `require` many nodejs module directly to the web.
//
// ## Source Code

(function() { "use strict";
var reun = {};
reun.log = function() {};

// Http(s) get utility function, as `fetch` is not generally available yet.
//
reun.urlGet = function urlGet(url) {
reun.log('urlGet', url);
return new Promise(function(resolve, reject) {
var xhr = new XMLHttpRequest();
xhr.open('GET', url);
xhr.onreadystatechange = function() {
if(xhr.readyState === 4) {
if(xhr.status === 200 && typeof xhr.responseText === 'string') {
resolve(xhr.responseText);
} else {
  reject(xhr);
}
}
}
xhr.send();
});
};


// When trying to load at module, that is not loaded yet, we throw this error:
//
function RequireError(module, url) {
  this.module = module;
  this.url = url;
}
RequireError.prototype.toString = function() {
  return 'RequireError:' + this.module +
    ' url:' + this.url;
}

// Convert a require-address to a url.
// path is baseurl used for mapping relative file paths (`./hello.js`) to url.
//
function moduleUrl(path, module) {
  if(module.slice(0,4) === 'reun') {
    return 'reun';
  }
  if(module.startsWith('https:') ||
      module.startsWith('http:')) {
    return module;
  }
  path = path.replace(/[?#].*.?/, '');
  path = (module.startsWith('.')
      ? path.replace(/[/][^/]*$/, '/')
      : 'https://unpkg.com/');
  path = path + module;
  while(path.indexOf('/./') !== -1) {
    path = path.replace('/./', '/');
  }
  var prevPath;
  do {
    prevPath = path;
    path = path.replace(/[/][^/]*[/][.][.][/]/g, '/');
  } while(path !== prevPath);
  return path;
}

var modules = {reun:reun};
function _eval(code, opt) {
  var opt = opt || {};
  reun.log('_eval', opt.uri);
  var result, wrappedSrc, module;
  var uri = typeof opt.uri === 'string' ? opt.uri : '';
  var require = function require(module, opt) {
    if(modules[module]) {
      return modules[module];
    }
    var url = moduleUrl(uri, module);
    if(!modules[url]) {
      throw new RequireError(module, url);
    }
    return modules[url];
  };
  if(typeof code === 'string') {
    wrappedSrc = '(function(module,exports,require){' +
      code + '})//# sourceURL=' + uri;
    module = {
      require: require,
      id: uri.replace('https://unpkg.com/', ''),
      uri: uri,
      exports: {}};
    code = function() {
      eval(wrappedSrc)(module, module.exports, require);
      return module.exports;
    };
  } else if(typeof self.require === 'undefined') {
    self.require = require;
  }
  try {
    result = code();
  } catch (e) {
    if(e.constructor !== RequireError) {
      throw e;
    }
    return reun.urlGet(e.url)
      .catch(function() {
        throw new Error('require could not load "' + e.url + '" ' +
            'Possibly module incompatible with http://reun.solsort.com/');
      }).then(function(moduleSrc) {
        return _eval(moduleSrc, {uri: e.url});
      }).then(function(exports) {
        modules[e.url] = exports;

        // Find the short name of the module, and remember it by that alias,
        // to make sure that later requires for the module without version/url
        // returns the already loaded module.
        //
        if(e.url.startsWith('https://unpkg.com/') ||
            exports.meta && exports.meta.id) {
          var name = e.url
            .replace('https://unpkg.com/', '')
            .replace(/[@/].*.?/, '');
          if(!modules[name]) {
            modules[name] = exports;
          }
        }
      }).then(function() {
        return _eval(code, opt);
      });
  }
  return Promise.resolve(result);
}

var evalQueue = Promise.resolve();

function doEval(code, opt) {
  evalQueue = evalQueue.then(function() {
    return _eval(code, opt);
  }).catch(function(e) {
    setTimeout(function() {
      throw e;
    }, 0);
  });
  return evalQueue;
}
reun.eval = doEval;

reun.require = function require(name) {
  if(self.module && self.module.require) {
    return Promise.resolve(require(name));
  }
  return doEval('module.exports = require(\'' + name + '\');',
      {uri: self.location && self.location.href || './'});
}

if(typeof module === 'object') {
  module.exports = reun;
} else {
  self.reun = reun;
}

// ## License
//
// This software is copyrighted solsort.com ApS, and available under GPLv3, as well as proprietary license upon request.
//
// Versions older than 10 years also fall into the public domain.
//

// <img src=https://direape.solsort.com/icon.png width=96 height=96 align=right>
//
// [![website](https://img.shields.io/badge/website-direape.solsort.com-blue.svg)](https://direape.solsort.com/)
// [![github](https://img.shields.io/badge/github-solsort/direape-blue.svg)](https://github.com/solsort/direape)
// [![codeclimate](https://img.shields.io/codeclimate/github/solsort/direape.svg)](https://codeclimate.com/github/solsort/direape)
// [![travis](https://img.shields.io/travis/solsort/direape.svg)](https://travis-ci.org/solsort/direape)
// [![npm](https://img.shields.io/npm/v/direape.svg)](https://www.npmjs.com/package/direape)
//
// ## DireApe - Distributed Reactive App Environment
//
// *Unstable - under development - do not use it yet*
//
// DireApe is an JavaScript library for making distributed reactive apps. It delivers:
//
// - message passing between processes
// - a reactive world state
//
// ## Concepts
//
// ### Processes / message parsing
//
// DireApe facilitates communication between processes. Every process has a globally unique id `pid` and a set of named mailboxes. It is possible to send messages to a given "mailbox `@` process id".
//
// The current supported processes are the browser main thread, and webworkers. The intention is to also send messages across the network, and to nodejs/workers.
//
// ### Reactive state
//
// Each process has a state that conceptually consist a consistent JSON-Object. The JSON-Object may also contain binary data, and is stored as an immmutable data structure, to allow fast diff'ing for reactive programming.
//
// It is possible to add reactive functions to the state, such that they are called when the state changes.
//
// ## API implementation
//
var da = reun;
da.eval(() => {
  da.log = function() {};

  // ### Defining handlers/reactions
  //
  // Keep track of the handlers/reactions. The keys are `name`, and the values are the corresponding functions.
  //
  // TODO: consider refactoring `handlers` to be a Map instead of an Object, - as we `delete`, which may be expensive.
  //
  da._handlers = {};

  // `da.handle("name", (...parameters) => promise)` adds a new event handler. When `name` is run/called, the function is executed, the new state replaces the old state, and the return/reject of the promise is returned.
  //
  da.handle = (name, f) => {
    da._handlers[name] = f;
  };

  // `da.reaction(name, () => promise)` - adds a reactive handle, that is executed when the `name` is emitted, or the accessed parts of the state has changed.
  //
  da.reaction = (name, f) => {
    if(!f) {
      delete reactions[name];
      delete da._handlers[name];
    } else {
      da._handlers[name] = makeReaction(name, f);
      return da._handlers[name];
    }
  };

  // ### Process / messages
  //
  // `da.pid` is the unique id of the current process. randomString has enough entropy, that we know with a probability as high as human certainty that the id is globally unique.

  da.pid = reun.pid || 'PID' + randomString();

  self.onmessage = o => send(o.data);

  // `da.run(pid, name, ...parameters)` executes a named handle in a process, and discards the result.

  da.run = function direape_run(pid, name) {
    var params = slice(arguments, 2);
    send({dstPid: pid, dstName: name, params: params});
  };

  // `da.call(pid, name, ...parameters) => promise` executes a named handle in a process, and returns the result as a promise. This is done by registring a temporary callback handler.

  da.call = function direape_call(pid, name) {
    //console.log('call', arguments);
    var params = slice(arguments, 2);
    return new Promise((resolve, reject) => {
      send({dstPid: pid, dstName: name,
        srcPid: da.pid,
        srcName: callbackHandler((val, err) => {
          //console.log('got-result', name, val, err);
          if(err) {
            reject(err);
          } else {
            resolve(val);
          }
        }),
        params: params});
    });
  };

  // ### Accessing the application state
  //
  // The state is an immutable value, which is useful for diffing, comparison, etc. The value only contains a JSON+Binary-object, such that it can always be serialised.
  //
  // Exposing an immutable object may also be useful outside of the library may be useful later on. It is not exposed / publicly available yet, to avoid exposing the immutable data structure, and we may want to use something simpler than the `immutable` library.
  //
  // TODO: extend the api to make immutable value available. For example like `da.getIn([...keys], defaultVale) => Immutable`. This is also why the api is called setJS/getJS, - as setIn/getIn should return immutable values.

  var immutable = require('immutable');
  var state = new immutable.Map();

  // `da.setJS([...keys], value)` sets a value, - only allowed to be called synchronously within a handler/reaction, to avoid race-conditions
  //
  // Making a change may also trigger/schedule reaction to run later.

  da.setJS = (path, value) => {
    state = setJS(state, path, value);
    reschedule();
  };

  // `da.getJS([...keys], defaultValue)` gets a value within the state

  da.getJS = (path, defaultValue) => {
    var result = state.getIn(path);
    accessHistoryAdd(path);
    return result === undefined ? defaultValue :
      (result.toJS ? result.toJS() : result);
  };

  // ### Creating / killing children
  //
  // Keep track of the child processes, by mapping their pid to their WebWorker object.
  //
  // TODO: may make sense to use a Map instead, as we do deletes.

  var children = {};

  // `da.spawn() => promise` spawn a new process, and return its pid as a promise.
  //
  // When the new worker is created, we send back and forth the pids, so the parent/children knows its child/parent. And then we also set up handling of messages.

  da.spawn = () => new Promise((resolve, reject) => {
    var childPid = 'PID' + randomString();
    var workerSourceUrl =
      (self.URL || self.webkitURL).createObjectURL(new Blob([`
            importScripts('https://unpkg.com/reun');
            reun.urlGet = function(url) {
              return new Promise((resolve, reject) => {
                self.postMessage(url);
                self.onmessage = o => {
                  resolve(o.data);
                };
              });
            };
            reun.pid = '${childPid}';
            reun.require('direape@0.1').then(da => {
              //reun.require('http://localhost:8080/direape.js').then(da => {
              //da.log = function() { console.log.apply(console,da._slice(arguments))};
              da.parent = '${da.pid}';
              reun.urlGet = url => da.call(da.parent, 'reun:url-get', url);
              self.postMessage({ready:true});
            });
            `], {type:'application/javascript'}));
      var child = new Worker(workerSourceUrl);
      children[childPid] = child;
      child.onmessage = o => {
        o = o.data;
        if(o.ready) {
          child.onmessage = o => send(o.data);
          return resolve(childPid);
        }
        reun.urlGet(o).then(val => {
          child.postMessage(val);
        });
      };
            });

            // `da.kill(pid)` kill a child process

            da.kill = (pid) => {
              children[pid].terminate();
              delete children[pid];
            };

            // `da.children()` lists live child processes

            da.children = () => Object.keys(children);


            // ## Built-in Handlers

            da.handle('reun:url-get', reun.urlGet);
            // setIn/getIn

            da.handle('da:setIn', da.setJS);
            da.handle('da:getIn', da.getJS);

            // TODO: make `reun:run` result serialisable, currently we just discard it

            da.handle('da:eval', (src, opt) =>
                reun.eval(src, opt).then(o => jsonify(o)));

            da.handle('da:subscribe', (path, opt) =>
                jsonify(da.reaction(`da:subscribe ${path} -> ${opt.name}@${opt.pid}`,
                    () => da.run(opt.pid, opt.name, path, da.getJS(path)))));

            da.handle('da:unsubscribe', (path, opt) =>
                da.reaction(`da:subscribe ${path} -> ${opt.name}@${opt.pid}`));
            // TODO:
            //
            // - `da:subscribe(path, handlerName)` - call `da.run(da.pid, handlerName, path, value)` on changes
            // - `da:unsubscribe(path, handlerName)`

            // ## Internal functions
            //
            // TODO more documentation in the rest of this file

            function callbackHandler(f) {
              var id = 'callback:' + randomString();
              da._handlers[id] = function() {
                delete da._handlers[id];
                return f.apply(null, slice(arguments));
              };
              return id;
            }

            // ###  Setting af JS-value deeply inside an immutable json object
            //
            // Utility function for setting a value inside an immutable JSON object.
            // The state is kept JSON-compatible, and thus we create Map/Object or List/Array depending on whether the key is a number or string.
            //
            // TODO: better error handling, ie handle wrong types, i.e. setting a number in an object or vice versa

            function setJS(o, path, value) {
              if(path.length) { // TODO: check that we are in handler, or else throw
                var key = path[0];
                var rest = path.slice(1);
                if(!o) {
                  if(typeof key === 'number') {
                    o = new immutable.List();
                  } else {
                    o = new immutable.Map();
                  }
                }
                return o.set(key, setJS(o.get(path[0]), path.slice(1), value));
              } else {
                return immutable.fromJS(value);
              }
            }

            // ### Handling access history for reactions
            var accessHistory = undefined;
            function accessHistoryAdd(path) {
              if(accessHistory) {
                accessHistory.add(JSON.stringify(path));
              }
            }

            // ### make reaction
            //
            // The reactions object is used to keep track of which of the handlers that are reactions.
            //
            // makeReaction, keeps track of whether a function is actually a reaction.
            //
            // TODO: think through whether there might be a bug: when a reaction is overwritten by a handler with the same name, - if the reaction is triggered, then it might call the handler?...
            //
            var reactions = {};
            function makeReaction(name, f) {
              reactions[name] = new Set(['[]']);
              var reaction = function() {
                if(da._handlers[name] !== reaction) {
                  delete reactions[name];
                  return;
                }
                var prevAccessHistory = accessHistory;
                accessHistory = new Set();
                try {
                  f();
                } catch(e) {
                  console.log('error during reaction', name, e);
                }
                if(reactions[name]) {
                  reactions[name] = accessHistory;
                }
                accessHistory = prevAccessHistory;
              };
              return reaction;
            }


            // ### Event loop
            //
            var prevState = state;
            var messageQueue = [];
            var scheduled = false;

            // #### request/schedule execution of reactions / sending pending messages

            function reschedule() {
              if(!scheduled) {
                nextTick(handleMessages);
                scheduled = true;
              }
            }

            // #### Send a message

            function send(msg) {
              da.log('send', msg);
              if(msg.dstPid === da.pid) {
                messageQueue.push(msg);
                reschedule();
              } else if(children[msg.dstPid]) {
                try {
                  children[msg.dstPid].postMessage(msg);
                } catch(e) {
                  try {
                    children[msg.dstPid].postMessage(jsonify(msg));
                  } catch(e2) {
                    console.log('send error', msg, e2);
                    throw e2;
                  }
                }
              } else {
                try {
                  self.postMessage(msg);
                } catch(e) {
                  console.log('send error', msg, e);
                  throw e;
                }
              }
            }

            // #### send a response to a message

            function sendResponse(msg, params) {
              if(msg.srcPid && msg.srcName) {
                send({
                  dstPid: msg.srcPid,
                  dstName: msg.srcName,
                  params: params});
              }
            }

            // #### dispatch all messages in the message queue and run reactions

            function handleMessages() {
              scheduled = false;
              if(messageQueue.length) {
                var messages = messageQueue;
                messageQueue = [];
                messages.forEach(handleMessage);
              }
              scheduleReactions();
            }

            // #### Request reactions to be executed

            function scheduleReactions() {
              if(prevState.equals(state)) {
                return;
              }

              var name, accessedPaths, accessedPath, path, changed, prev, current;
              for (name in reactions) {
                accessedPaths = reactions[name];
                changed = false;
                for (accessedPath of accessedPaths) {
                  path = JSON.parse(accessedPath);
                  prev = prevState.getIn(path);
                  current = state.getIn(path);
                  if (prev !== current) {
                    if ((prev instanceof immutable.Map ||
                          prev instanceof immutable.List)
                        && prev.equals(current)){
                      continue;
                    }
                    changed = true;
                    break;
                  }
                }
                if(changed) {
                  send({dstPid: da.pid, dstName: name});
                }
              }
              prevState = state;
            }

            // #### Handle a single message

            function handleMessage(msg) {
              da.log('handleMessage', msg);
              try {
                if(!da._handlers[msg.dstName]) {
                  console.log('Missing handler: ' + msg.dstName);
                  throw new Error('Missing handler: ' + msg.dstName);
                }
                Promise
                  .resolve(da._handlers[msg.dstName].apply(null, msg.params))
                  .then(o => sendResponse(msg, [o]),
                      e => sendResponse(msg, [null, jsonify(e)]));
              } catch(e) {
                sendResponse(msg, [null, jsonify(e)]);
              }
            }


            // ### Generic utility function
            //
            // May be temporarily exported, during development, but not intended to be used outside of module.

            // TODO extract common code to common core library
            da._jsonify = jsonify;
            da._slice = slice;
            da._jsonReplacer = jsonReplacer;

            function jsonify(o) {
              return JSON.parse(JSON.stringify([o], (k,v) => jsonReplacer(v)))[0];
            }

            var jsonifyWhitelist =
              ['stack', 'name', 'message',
            'id', 'class', 'value'
              ];

            function jsonReplacer(o) {
              if((typeof o !== 'object' && typeof o !== 'function') || o === null || Array.isArray(o) || o.constructor === Object) {
                return o;
              }
              var result, k, i;
              if(typeof o.length === 'number') {
                result = [];
                for(i = 0; i < o.length; ++i) {
                  result[i] = o[i];
                }
              }
              result = Object.assign({}, o);
              if(o.constructor && o.constructor.name && result.$_class === undefined) {
                result.$_class = o.constructor.name;
              }
              if(o instanceof ArrayBuffer) {
                //
                // TODO btoa does not work in arraybuffer,
                // and apply is probably slow.
                // Also handle Actual typed arrays,
                // in if above.
                //
                result.base64 = self.btoa(String.fromCharCode.apply(null, new Uint8Array(o)));
              }
              for(i = 0; i < jsonifyWhitelist.length; ++i) {
                k = jsonifyWhitelist[i] ;
                if(o[k] !== undefined) {
                  result[k] = o[k];
                }
              }
              return result;
            }

            function randomString() {
              return Math.random().toString(32).slice(2) +
                Math.random().toString(32).slice(2) +
                Math.random().toString(32).slice(2);
            }
            function nextTick(f) {
              setTimeout(f, 0);
            }
            function slice(a, start, end) {
              return Array.prototype.slice.call(a, start, end);
            }

            // ## exports
            //
            self.direape = da;

            // ## Main / test
            //
            // this is currently just experimentation during development.
            //
            // TODO: replace this with proper testing

            //console.log('started', da.pid);
            da.main = () => {
              console.log('running', da.pid);
              reun.log = da.log = function() { console.log(slice(arguments)); };
              da.reaction('blah', () => {
                console.log('blah', da.getJS(['blah']));
              });

              da.setJS(['blah', 1, 'world'], 'hi');
              console.log('here', da.getJS(['blah']));

              da.handle('hello', (t) => {
                da.setJS(['blah'], '123');
                console.log('hello', t);
                return 'hello' + t;
              });
              da.run(da.pid, 'hello', 'world');
              da.call(da.pid, 'hello', 'to you').then(o => console.log(o));
              da.call(da.pid, 'hello', 'to me').then(o => console.log(o));
              da.setJS(['hi'], 'thread-1');
              da.spawn().then(child => {
                da.handle('log', function () { console.log('log', arguments); });
                da.call(child, 'da:subscribe', ['hi'], {pid: da.pid, name: 'log'});
                da.call(child, 'da:eval',
                    'require("http://localhost:8080/direape.js").setJS(["hi"], "here");',
                    'http://localhost:8080/')
                  .then(result => console.log('result', result))
                  .then(() => da.call(child, 'da:getIn', ['hi'], 123))
                  .then(o => console.log('call-result', o))
                  .then(() => da.call(da.pid, 'da:getIn', ['hi'], 432))
                  .then(o => console.log('call-result', o));
              });
              console.log(Object.keys(da));
              try {
                throw new Error();
              } catch(e) {
                console.log(jsonify(e));
              }
              console.log(undefined);
              document.body.onclick = function(e) {
                console.log(jsonify(e));
              };
              document.body.click();
              da.setJS(['foo'], 123);
              da.reaction('a', o => {
                console.log('a', da.getJS(['foo']));
                console.log('b', da.getJS(['baz']));
              });
              setTimeout(o => da.setJS(['bar'], 456), 200);
              setTimeout(o => da.setJS(['foo'], 789), 400);
            };
  });
})();
*/

