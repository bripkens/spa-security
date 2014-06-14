var uuid = require('node-uuid');

// maps username => password
var users = {
  'tom': 'tom123',
  'jenni': 'jenni123'
};


module.exports = function(app, redis) {
  function generateAccessToken(user, cb) {
    var accessToken = uuid.v4();
    var tokenInfo = {
      accessToken: accessToken,
      user: user,
      creationDate: new Date()
    };

    var data = JSON.stringify(tokenInfo);
    redis.hset('access_tokens', accessToken, data, function(err) {
      if (err) {
        cb(err, null);
      } else {
        cb(null, tokenInfo);
      }
    });
  }


  function onlyUnauthorized(fn) {
    return function(req, res, next) {
      var accessToken = req.signedCookies['access_token'];

      if (!accessToken) {
        return fn.apply(this, arguments);
      }

      var args = arguments;
      redis.hget('access_tokens', accessToken, function(err, replies) {
        if (err) {
          console.error(err);
          return res.redirect('/error?info=db%20error');
        }

        if (!replies) {
          return fn.apply(this, args);
        }

        return res.redirect('/app');
      });
    };
  }


  function requireAuth(fn) {
    return function(req, res) {
      var accessToken = req.signedCookies['access_token'];
      if (!accessToken) {
        return res.redirect('/signin?reason=not%20logged%20in');
      }

      var args = arguments;
      redis.hget('access_tokens', accessToken, function(err, tokenInfo) {
        if (err) {
          console.error(err);
          return res.redirect('/error?info=db%20error');
        }

        if (!tokenInfo) {
          return res.redirect('/signin?reason=invalid%20access%20token');
        }

        tokenInfo = JSON.parse(tokenInfo);
        req.user = tokenInfo.user;

        return fn.apply(this, args);
      });
    };
  }


  app.get('/', function(req, res) {
    res.redirect('/signin');
  });


  app.get('/signin', onlyUnauthorized(function(req, res) {
    res.sendfile('assets/signin.html');
  }));


  app.get('/signout', function(req, res) {
    var accessToken = req.signedCookies['access_token'];
    if (!accessToken) {
      return res.redirect('/');
    }

    redis.hdel('access_tokens', accessToken);
    res.clearCookie('access_token');
    res.redirect('/');
  });


  app.post('/signin', function(req, res) {
    var user = req.body.user;
    var success = users.hasOwnProperty(user) &&
      users[user] === req.body.password;

    if (!success) {
      return res.redirect('/signin?reason=invalid%20user%20or%20pw');
    }

    generateAccessToken(user, function(err, tokenInfo) {
      if (err) {
        console.error(err);
        return res.redirect('/signin?reason=db%20error');
      }

      var cookieOpts = {
        httpOnly: true,
        signed: true
      };

      // we are not using https during development, so don't set the secure opt
      if (process.env.PRODUCTION === 'true') {
        cookieOpts['secure'] = true;
      }
      res.cookie('access_token', tokenInfo.accessToken, cookieOpts);
      res.redirect('/app');
    });
  });


  app.get('/app', requireAuth(function(req, res) {
    res.sendfile('assets/spa.html');
  }));


  app.get('/error', function(req, res) {
    res.sendfile('assets/error.html');
  });


  app.get('/userinfo', requireAuth(function(req, res) {
    res.json({
      user: req.user
    });
  }));
};
