'use strict';

var util    = require('util');
var qs      = require('querystring');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var SearchEndpoint = require('./search_endpoint');
var HttpHandler = require('./http_handler').Handler;

/**
 * Constructor
 * @param {request} httpClient
 * @param {string} baseUrl
 */
function ESClient(params) {
  this.settings = _.extend({}, this.defaults(), params);
  this.handler = this.settings.handler || this._createHandler(this.settings.httpHandler);
  this.searchEndpoint = new SearchEndpoint();
  EventEmitter.apply(this, arguments);
}

util.inherits(ESClient, EventEmitter);

// Extending AWS.TemporaryCredentials API
util._extend(ESClient.prototype, {

  defaults: function() {
    return {
      host: {
        host: '127.0.0.1',
        protocol: 'http',
        port: 9200
      },
      httpHandler: {
        agentConfig: {
          keepAlive: true,
          maxSockets: 50,
          minSockets: 30  
        }
      }
    };
  },
  
  search: function(params, cb) {

    var _this = this;
    var body = params.body;
    var headers = {};
    
    if (params.index) {
      this.searchEndpoint.setIndex(params.index);  
    }

    if (params.type) {
      this.searchEndpoint.setIndex(params.type);  
    }

    if (body) {
      body = this._serialiseBody(params.body);
      headers['content-type'] = 'application/json';
    }

    var reqParams = {
      method: 'POST',
      path: _this.searchEndpoint.getURI(),
      headers: headers,
      body: body,
    };

    if (params.search_type) {
      reqParams['query'] = {
        search_type: params.search_type
      };
    }

    var prepareAndSendResponse = function(response, statusCode, headers) {
      var error = null;
      var states = HttpHandler.states;
      var parsedResponse;

      try {
        parsedResponse = _this._parseResponse(response);
      } catch(err) {
        error = err;
      }

      if (statusCode < 200 || statusCode >= 400) {
        error = new Error((states[String(statusCode)]) ? states[String(statusCode)] : 'Elasticsearch error status');
      }

      cb(error, parsedResponse, statusCode, headers);
    };
    
    var checkForErrors = function(err, response, statusCode, headers) {
      if (err) {
        return cb(err, response,statusCode, headers);
      }
      prepareAndSendResponse(response, statusCode, headers);
    };

    this.handler.performRequest(reqParams, checkForErrors);
  },

  _createHandler: function(params) {
    params = params || {};
    params.host = this.settings.host;

    return new HttpHandler(params);
  },
  _serialiseBody: function(body) {
    body = body || {};
    return JSON.stringify(body);
  },
  _parseResponse: function(response) {
    return JSON.parse(response);
  }
});

module.exports = {
  Client: ESClient
};
