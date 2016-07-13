'use strict';

var _ = require('lodash');
var util = require('util');
var qs   = require('querystring');

var handlers = {
  http: require('http'),
  https: require('https')
};

function ESHttpHandler(params) {
  params = params || {};
  this.host = params.host;
  this.handler = handlers[this.host.protocol];
  this.agent = this.makeAgent(params.agentConfig);
}

ESHttpHandler.states = {
  '400':  'Bad Request',
  '401':  'Authentication Exception',
  '402':  'Payment Required',
  '403': 'Authorization Exception',
  '404': 'Not Found',
  '405': 'Method Not Allowed',
  '406': 'Not Acceptable',
  '407': 'Proxy Authentication Required',
  '408': 'Request Timeout',
  '409': 'Conflict',
  '410': 'Gone',
  '411': 'Length Required',
  '500': 'Internal Server Error',
  '501': 'Not Implemented',
  '502': 'Bad Gateway',
  '503': 'Service Unavailable',
  '504': 'Gateway Timeout'
};

ESHttpHandler.prototype = {
    
  makeReqParams: function (params) {
    params = params || {};
    var host = this.host;
    var _this = this;

    var reqParams = {
      method: params.method || 'GET',
      protocol: host.protocol + ':',
      hostname: host.host,
      port: host.port,
      path: (host.path || '') + (params.path || ''),
      headers: params.headers,
      agent: _this.agent
    };

    if (!reqParams.path) {
      reqParams.path = '/';
    }

    if (params.query) {
      reqParams.path += '?' + qs.stringify(params.query);
    }

    return reqParams;
  },

  makeAgent: function(params)  {
    params = _.extend({
      keepAlive: true,
      maxSockets: 30,
      minSockets: 30
    }, params);

    return new this.handler.Agent(params);
  },
  performRequest: function(params, cb) {
    var reqParams = this.makeReqParams(params),
      _this = this, 
      request,
      response,
      responseBody = '';

    var handleError = function(err) {
      request && request.removeAllListeners();
      response && response.removeAllListeners();
      if (err) {
        return cb(err);  
      } else {
        cb(new Error('There was an error queries ES host'));
      }
    };

    var handleSuccess = function(err) {
      request && request.removeAllListeners();
      response && response.removeAllListeners();
      cb(null, responseBody, response.statusCode, response.headers);
    };
    
    request = this.handler.request(reqParams, function (res) {
      response = res;
      var status = response.statusCode;
      var headers = response.headers;
      
      // var encoding = (headers['content-encoding'] || '').toLowerCase();
      // if (encoding === 'gzip' || encoding === 'deflate') {
      //   response	 = response	.pipe(zlib.createUnzip());
      // }

      response.setEncoding('utf8');
      response.on('data', function (d) {
        responseBody += d;
      });

      response.on('error', handleError);
      response.on('end', handleSuccess);
    });

    request.on('error', handleError);

    request.setNoDelay(true);
    request.setSocketKeepAlive(true);

    if (params.body) {
      request.setHeader('Content-Length', Buffer.byteLength(params.body, 'utf8'));
      request.end(params.body);
    } else {
      request.setHeader('Content-Length', 0);
      request.end();
    }
  }
};

module.exports = {
  Handler: ESHttpHandler
};
