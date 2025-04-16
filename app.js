var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var bodyParser = require('body-parser');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// cors-anywhere
const corsProxy = require('cors-anywhere').createServer({
    originWhitelist: [],
    // requireHeader: ['origin', 'x-requested-with'],
    requireHeader: [],
    removeHeaders: ['cookie', 'cookie2']
});
function isAllowedTarget(targetUrlStr) {
    // If only allow ppy:
    // const url = new URL(decodeURIComponent(targetUrlStr));
    // const targetHost = url.hostname.toLowerCase();
    // return (targetHost === 'ppy.sh' || targetHost.endsWith('.ppy.sh'));

    // Allow all, because user may have custom background pic url
    return true;
}
app.use('/proxy', (req, res) => {
    const targetUrl = req.originalUrl.replace('/proxy/', '');
    if (!isAllowedTarget(targetUrl))
        return res.status(403).send(`
        Proxy service only allows ppy.sh domains.
        Blocked url: ${targetUrl}
      `);

    req.url = decodeURIComponent(req.url.replace('/proxy/', '/'));
    corsProxy.emit('request', req, res);
});

// osu-api-v2-js
let osuApi;
(async () => {
    let osu = await import('osu-api-v2-js');
    try {
        osuApi = await osu.API.createAsync(
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET
        );
    } catch (error) {
        console.error('osu-api-v2-js init error: ', error);
        process.exit(1);
    }
})();

// POST api get user
app.use(bodyParser.urlencoded({ extended: true }));
app.post('/api/getUserFromUsername', async (req, res) => {
    try {
        const username = req.body.username;
        const user = await osuApi.getUser(username);

        res.json({
            status: 'success',
            user: user
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'error',
            error: error
        });
    }
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = app;

