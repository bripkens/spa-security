var uuid = require('node-uuid');
var crypto = require('crypto');

// maps username => password
var users = {
  'tom': 'tom123',
  'jenni': 'jenni123'
};

var doubleCookieSecret = 'blub bla';

function createAccessTokenCheck(accessToken) {
  return crypto
    .createHmac('sha256', doubleCookieSecret)
    .update(accessToken)
    .digest('base64')
    .replace(/\=+$/, '');
}

module.exports = function(app, redis) {

  app.use(function(req, res, next) {
    req.usesCookiesForAuth = function() {
      return !!req.signedCookies['access_token'];
    };

    res.json = function(v) {
      var json = JSON.stringify(v);
      if (req.usesCookiesForAuth()) {
        // prevent JSON hijacking
        // http://haacked.com/archive/2009/06/25/json-hijacking.aspx/
        json = 'for(;;);' + json;
      }
      res.header('Content-Type', 'application/json').send(json);
    };

    next();
  });

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
      // var accessTokenCheck = req.header('access_token_csrf_check');

    if (!accessToken /*|| !accessTokenCheck*/) {
        res.clearCookie('access_token');
        // res.clearCookie('access_token_csrf_check');
        return res.redirect('/signin?reason=not%20logged%20in');
      }

      // TODO check when request method !== OPTIONS, HEAD OR GET
      // if (createAccessTokenCheck(accessToken) !== accessTokenCheck) {
      //   res.clearCookie('access_token');
      //   res.clearCookie('access_token_csrf_check');
      //   return res.redirect('/error?info=oh%20oh,%20CSRF%20issues?');
      // }

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


  app.post('/signout', function(req, res) {
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


      var isProduction = process.env.PRODUCTION === 'true';

      res.cookie(
        'access_token',
        tokenInfo.accessToken,
        {
          httpOnly: true,
          signed: true,
          secure: isProduction
        }
      );

      res.cookie(
        'access_token_csrf_check',
        createAccessTokenCheck(tokenInfo.accessToken),
        {
          secure: isProduction
        }
      );

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

  app.get('/accountbalance', requireAuth(function(req, res) {
    res.json([
      {
        accountnumber: 123,
        balance: '346.30'
      },
      {
        accountnumber: 456,
        balance: '8192.39'
      }
    ]);
  }));

  app.post('/transferfunds', requireAuth(function(req, res) {
    res.json({
      msg: 'Funds transferred!'
    });
  }));
};
