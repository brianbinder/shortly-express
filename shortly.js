var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
//var cookieParser = require('cookie-parser');
var session = require('express-session');
var bcrypt = require('bcrypt');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
app.use(session({
  secret: 'somerandonstuffs',
  resave: false,
  saveUninitialized: false,
  cookie: {
    expires: 15000
  },
  maxAge: 15000
}));

// This allows you to set req.session.maxAge to let certain sessions
// have a different value than the default.
app.use(function (req, res, next) {
  console.log('req session maxAge *********** = ', req.session.maxAge);
  console.log('req session-options !!!!!!!!!!!!! = ', req.sessionOptions);
  //req.sessionOptions.maxAge = req.session.maxAge || req.sessionOptions.maxAge
  next();
});



app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(function(req, res, next) { // in cb :
  //check if not logged in ( session exist )
  console.log('req.path line 30: ', req.path);
  if ((req.path === '/' || req.path === '/links' || req.path === '/create')
      && !req.session.user) {
    console.log('req.path line 32: ', req.path);
    res.redirect('/login');
  } else {
    next();
  }
});

app.get('/login',
  function(req, res) {
    console.log('is redirecting in /login');
    res.render('login');
  });

app.get('/signup',
  function(req, res) {
    console.log('loading the signup page');
    res.render('signup');
  });

app.get('/',
  function(req, res) {
    console.log(' "/" shortly.js');
    res.render('index');
  });

app.get('/create',
  function(req, res) {
    console.log(' /create shortly.js');
    res.render('index');
  });


app.get('/links',
  function(req, res) {
    Links.reset().fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  });

app.post('/links',
  function(req, res) {
    var uri = req.body.url;

    if (!util.isValidUrl(uri)) {
      console.log('Not a valid url: ', uri);
      return res.sendStatus(404);
    }

    new Link({ url: uri }).fetch().then(function(found) {
      if (found) {
        res.status(200).send(found.attributes);
      } else {
        util.getUrlTitle(uri, function(err, title) {
          if (err) {
            console.log('Error reading URL heading: ', err);
            return res.sendStatus(404);
          }

          Links.create({
            url: uri,
            title: title,
            baseUrl: req.headers.origin
          })
            .then(function(newLink) {
              res.status(200).send(newLink);
            });
        });
      }
    });
  });

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.post('/login',
  function(req, res) {
  // if the username is not in db, then redirect
  //Users.findOne
    var username = req.body.username;
    var password = req.body.password;
    console.log('username: ', username);
    console.log('password: ', password);

    new User({ username: username }).fetch().then(function(found) {
      if (found) {
        console.log('found: ', found);
        bcrypt.compare(password, found.attributes.password, function(error, result) {
          console.log('result: ', result);
          if (result) {
            var user = found.attributes;
            req.session.user = user;
            res.redirect('/');
          } else {
            res.redirect('/login');
          }
        });
      } else {
        res.redirect('/login');
      }
    });


  });

app.post('/signup',
  function(req, res) {
    console.log('req.body: ', req.body);
    console.log('req.body: ', req.body.username);
    console.log('req.body: ', req.body.password);

    // get user input
    var username = req.body.username;
    var password = req.body.password;

    // encrypt password
    var salt = bcrypt.genSaltSync();
    password = bcrypt.hashSync(password, salt);



    Users.create(new User({
      username: username,
      password: password
    })).then(function(user) {
      console.log('user: ', user);
      req.session.user = user.attributes;
      // if !err
      res.redirect('/');
    // redirect to index
    });
  //Users.create()
  });


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
