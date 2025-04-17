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
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// cors-anywhere
const allowedRefererDomains = [
    process.env.HOSTNAME,
    'http://localhost:3000'
];
const corsProxy = require('cors-anywhere').createServer({
    originWhitelist: [],
    // requireHeader: ['origin', 'x-requested-with'],
    requireHeader: [],
    removeHeaders: ['cookie', 'cookie2']
});
function isAllowedTarget(targetUrlStr) {
    // If only allow ppy.sh:
    /* try {
        const url = new URL(decodeURIComponent(targetUrlStr));
        const targetHost = url.hostname.toLowerCase();
        return (targetHost === 'ppy.sh' || targetHost.endsWith('.ppy.sh'));
    } catch (_) {
    }
   return false; */

    // Allow all, because user may have custom background pic url
    return true;
}
function isAllowedReferer(referer) {
    try {
        const refUrl = new URL(referer);
        return allowedRefererDomains.includes(refUrl.origin);
    } catch (_) {
    }
    return false;
}
app.use('/proxy', (req, res) => {
    const targetUrl = req.originalUrl.replace('/proxy/', '');
    if (!isAllowedTarget(targetUrl))
        return res.status(403).send(`Proxy service only allows certain target domains.
Blocked url: ${targetUrl}`);
    if (!isAllowedReferer(req.headers.referer))
        return res.status(403).send(`Forbidden`);
    req.url = decodeURIComponent(req.url.replace('/proxy/', '/'));
    corsProxy.emit('request', req, res);
});

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// osu-api-v2-js
let osuApi = null;
const maxRetries = 10;
const retryFirstInterval = 1000; // milliseconds
async function initOsuApi() {
    if (osuApi !== null)
        return;
    let osu = await import('osu-api-v2-js');
    let err = null;
    let retryDelay = retryFirstInterval;
    for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        try {
            osuApi = await osu.API.createAsync(
                process.env.CLIENT_ID,
                process.env.CLIENT_SECRET
            );
            err = null;
            break;
        } catch (error) {
            console.error('osu-api-v2-js init error: ', error);
            err = error;
            console.error('retry after ', retryDelay, 'ms ...');
            sleep(Math.round(retryDelay));
            retryDelay *= 1.5;
            retryDelay += Math.random() * retryFirstInterval;
        }
    }
    if (err !== null) {
        console.error('retried ', maxRetries, ' times, give up');
        throw err;
    }
}

// POST api get user
app.use(bodyParser.urlencoded({ extended: true }));
app.post('/api/getUserFromUsername', async (req, res) => {
    try {
        await initOsuApi();
    } catch (error) {
        console.error('error when initOsuApi: ', error);
        res.status(500).json({
            status: 'error',
            message: 'error when initOsuApi',
            error: error
        });
        return;
    }
    try {
        const username = req.body.username;
        const user = await osuApi.getUser(username);

        res.json({
            status: 'success',
            user: user
        });
    } catch (error) {
        // reset osuApi when error, but no need when it is just user not found
        if (error?.status_code !== 404) {
            osuApi = null;
            console.error('error when osuApi.getUser', error);
        }
        res.status(500).json({
            status: 'error',
            message: 'error when osuApi.getUser',
            error: error
        });
        return;
    }
});

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});


module.exports = app;

