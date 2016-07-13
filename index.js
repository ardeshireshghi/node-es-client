#!/usr/bin/env node
var ArgumentParser = require('argparse').ArgumentParser;
var appVersion = require('./package.json').version;
var appDescription = require('./package.json').description;
var elasticsearch = require('./lib/client.js');
var async = require('async');
var fs = require('fs');
var client;
var concurrency;
var threadsPerSecond;
var keywords;
var queryTemplate;

function getArgParser() {
  var parser = new ArgumentParser({
    version: appVersion,
    addHelp: true,
    description: appDescription
  });

  parser.addArgument(
    [ '-f', '--file' ],
    {
      help: 'Path to file with search query URLS'
    }
  );

  parser.addArgument(
    [ '-e', '--endpoint' ],
    {
      help: 'URL of ES endpoint'
    }
  );

  parser.addArgument(
    ['-c', '--concurrency' ],
    {
      help: 'Number of concurrent requests'
    }
  );

  parser.addArgument(
    ['-t', '--transactions'],
    {
      help: 'Number of transactions/threads per second'
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
  return new elasticsearch.Client({
    host: {
      protocol: 'http',
      host: params.searchEndpoint,
      port: 80
    },
    httpHandler: {
        agentConfig: {
          keepAlive: true,
          maxSockets: 30,
          minSockets: 5
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
    }
  });
}

function initialise() {
  var parser = getArgParser();
  var args = parser.parseArgs();
  var searchEndpoint = args.endpoint;

  concurrency = parseInt(args.concurrency);
  threadsPerSecond = parseInt(args.transactions);
  keywords = getKeywords(args.file);
  queryTemplate = getTemplate();
  client = createESClient({searchEndpoint: searchEndpoint});

  performSearchQueries(keywords.splice(0, concurrency));
}

initialise();
