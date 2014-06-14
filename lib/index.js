var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var redis = require('redis');
var util = require('util');

console.log('##################################################');
console.log('        Starting SPA Security example');

if (process.argv.length < 4) {
  console.error('Please pass the Redis host and part as parameters.');
  return process.exit(1);
}

var redisHost = process.argv[2];
var redisPort = parseInt(process.argv[3], 10);
console.log('Using Redis: %s:%d', redisHost, redisPort);

var redisClient = redis.createClient(redisPort, redisHost);

var app = express();

app.use(cookieParser(')=/§=!" uidsakjlh1231##1"'));
app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

require('./routes')(app, redisClient);

var server = app.listen(3000, function() {
  console.log('Application listening on %d', server.address().port);
});
