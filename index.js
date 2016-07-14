#!/usr/bin/env node

var ArgumentParser = require('argparse').ArgumentParser;
var appVersion = require('./package.json').version;
var appDescription = require('./package.json').description;
var async = require('async');
var fs = require('fs');
var client;
var concurrency;
var threadsPerSecond;
var keywords;
var queryTemplate;
var testStartTime;
var testEndTime;

function getArgParser() {
  var parser = new ArgumentParser({
    version: appVersion,
    addHelp: true,
    description: appDescription
  });

  parser.addArgument(
    [ '-f', '--file' ],
    {
      help: 'Path to file with search query URLS',
      required: true
    }
  );

  parser.addArgument(
    [ '-e', '--endpoint' ],
    {
      help: 'URL of ES endpoint',
      required: true
    }
  );

  parser.addArgument(
    ['-c', '--concurrency' ],
    {
      help: 'Number of concurrent requests',
      defaultValue: 30,
      required: false
    }
  );

  parser.addArgument(
    ['-t', '--transactions'],
    {
      help: 'Number of transactions/threads per second',
      defaultValue: 30,
      required: false
    }
  );

   parser.addArgument(
    ['--client'],
    {
      help: 'ES client library type e.g (custom, default)',
      defaultValue: 'default',
      required: false
    }
  );

  return parser;
}

/**
 * Factory method which creates a elastic search object
 * @param  {AWS.credentials} credentials
 * @return {elasticsearch.Client}
 */
function createESClient(params) {
  var clientModulePath = (params.clientType === 'default')
                      ? 'elasticsearch'
                      : './lib/client.js';
  var elasticsearch = require(clientModulePath);
  return new elasticsearch.Client({
    host: {
      protocol: 'http',
      host: params.searchEndpoint,
      port: 80
    },
    httpHandler: {
        agentConfig: {
          keepAlive: true,
          maxSockets: 11,
          minSockets: 10
        }
    }

  });
}

function getKeywords(queriesFile) {
  var data = fs.readFileSync(queriesFile);
  return data.toString().trim().split('\r\n').map(function(url) {
      return decodeURIComponent(url).match(/q=(.+)/)[1].split('&')[0];
  });
}

function getTemplate() {
  return fs.readFileSync(__dirname + '/query_template.json', 'utf-8');
}

function doSearch(params, cb) {
  var startTime = Date.now();
  client.search(params, function(err, response, status, headers) {
    if (err) {
      return cb(err);
    }

    var requestTimeElapsed = Date.now() - startTime;
    var esTook = response.took;
    console.log('%s,%s,%s', esTook, requestTimeElapsed, params.keyword);
    cb();
  });
}

function performSearchQueries(keywordChunk) {
  async.each(keywordChunk, function(keyword, callback) {
    doSearch({
      body: JSON.parse(queryTemplate.replace(/{{queryKeyword}}/g, keyword)),
      search_type: 'count',
      index: 'resolution_query_alias',
      keyword: keyword
    }, callback);
  }, function(err) {
    if (err) {
      console.log(err);
      return;
    }
    if (keywords.length) {
      performSearchQueries(keywords.splice(0, concurrency))
    } else {
      testEndTime = Date.now();
      console.log('Test took: %s seconds', (testEndTime - testStartTime) / 1000);
    }
  });
}

function initialise() {
  var parser = getArgParser();
  var args = parser.parseArgs();
  var searchEndpoint = args.endpoint;

  concurrency = parseInt(args.concurrency, 10);
  threadsPerSecond = parseInt(args.transactions, 10);
  keywords = getKeywords(args.file);
  queryTemplate = getTemplate();
  client = createESClient({
    searchEndpoint: searchEndpoint,
    clientType: args.client
  });

  testStartTime = Date.now();
  performSearchQueries(keywords.splice(0, concurrency));
}

module.exports = initialise;

initialise();
