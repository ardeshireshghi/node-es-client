'use strict';

function AbstractEndpoint() {}

AbstractEndpoint.prototype = {
  setIndex: function(index) {
    this.index = index;
  },
  setType: function() {
    this.type = type;
  },
  setBody: function(body) {
    this.body = body;
  },
  getBody: function() {
    return this.body;
  },

  getURI: function() {
    throw new Error('This should be implemented in a child class');
  }
};

module.exports = AbstractEndpoint;
