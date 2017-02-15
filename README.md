<img src=https://fri.solsort.com/icon.png width=96 height=96 align=right>

[![website](https://img.shields.io/badge/website-fri.solsort.com-blue.svg)](https://fri.solsort.com/)
[![github](https://img.shields.io/badge/github-solsort/fri-blue.svg)](https://github.com/solsort/fri)
[![codeclimate](https://img.shields.io/codeclimate/github/solsort/fri.svg)](https://codeclimate.com/github/solsort/fri)
[![travis](https://img.shields.io/travis/solsort/fri.svg)](https://travis-ci.org/solsort/fri)
[![npm](https://img.shields.io/npm/v/fri.svg)](https://www.npmjs.com/package/fri)

# Functional Reactive Immutable data

*Under heavy development, do not use yet*

    var da = require('direape');
    var fri = module.exports; da.testSuite('fri');
    
## Main
    if(require.main === module) {
      da.ready(() => 
          da.runTests('fri')
          .then(() => da.isNodeJs() && process.exit(0))
          .catch(() => da.isNodeJs() && process.exit(-1)));
    }
