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

if(require.main === module) {
  da.ready(() => {
    da.runTests('fri');
  });
}

// ## Reactive State
//
// ### TODO `setState(o)`
// ### TODO `getState()`
// ### TODO `reaction(f, params)` returns reaction, which when called returns result
// ### TODO `rerun(name, reaction)`
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
