"use strict"

// require files
require("jquery");
require("underscore");
require("backbone"); 
require("parsleyjs");
require("selectize");
// require('./js/poll');

var poll = require('./js/poll');
exports.poll = poll;

// require sass
require('./style/poll.sass');
