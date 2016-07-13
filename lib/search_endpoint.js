'use strict';

var util = require('util');
var AbstractEndpoint = require('./abstract_endpoint');

function SearchEndpoint() {
  AbstractEndpoint.apply(this, arguments);
}

util.inherits(SearchEndpoint, AbstractEndpoint);

util._extend(SearchEndpoint.prototype, {
  getURI: function() {
    var index = this.index;
    var type = this.type;
    var uri = "/_search";

    if (index && type) {
      uri = '/' + index + '/' + type + uri;
    } else if (index) {
      uri = '/' + index + uri;
    } else if (type) {
      uri = '/_all/' + type + uri; 
    }

    return uri;
  }
});

module.exports = SearchEndpoint;
