// <img src=https://fri.solsort.com/icon.png width=96 height=96 align=right>
//
// [![website](https://img.shields.io/badge/website-fri.solsort.com-blue.svg)](https://fri.solsort.com/)
// [![github](https://img.shields.io/badge/github-solsort/fri-blue.svg)](https://github.com/solsort/fri)
// [![codeclimate](https://img.shields.io/codeclimate/github/solsort/fri.svg)](https://codeclimate.com/github/solsort/fri)
// [![travis](https://img.shields.io/travis/solsort/fri.svg)](https://travis-ci.org/solsort/fri)
// [![npm](https://img.shields.io/npm/v/fri.svg)](https://www.npmjs.com/package/fri)
//
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


