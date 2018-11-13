const PORT = process.env.PORT || 9292;
/*
 ** Get all the required libraries
 */

const http = require("http");
const debug = require("debug")("evolvus-charges-server:server");
const express = require("express");
const bodyParser = require("body-parser");
const connection = require("@evolvus/evolvus-mongo-dao").connection;
const axios = require("axios");
const app = express();
const router = express.Router();
const moment = require("moment");

var dbConnection = connection.connect("CHARGES");
var ChargesServiceUrl = process.env.CHARGES_SERVICE_URL || "http://192.168.1.18:9292/api";
var reattemptSchedulePeriod = process.env.SCHEDULE_PERIOD_REATTEMPT || "1 1 1 * * *";
var billGenerationSchedulePeriod = process.env.SCHEDULE_PERIOD_BILL || "1 1 1 1 * * ";

app.use(function (req, res, next) {
  // res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Request-Headers", "*");
  res.header('Access-Control-Allow-Methods', 'GET, POST,PUT, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With,X-HTTP-Method-Override, Content-Type, Accept, Authorization,entityId,tenantId,entityCode,accessLevel");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

app.use(bodyParser.urlencoded({
  limit: '1mb',
  extended: true
}));

app.use(bodyParser.json({
  limit: '1mb'
}));

require("./routes/main")(router);

app.use("/api", router);

/*
* * * * * *
┬ ┬ ┬ ┬ ┬ ┬
│ │ │ │ │ │
│ │ │ │ │ └ day of week (0 - 7) (0 or 7 is Sun)
│ │ │ │ └───── month (1 - 12)
│ │ │ └────────── day of month (1 - 31)
│ │ └─────────────── hour (0 - 23)
│ └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, OPTIONAL)
*/
var schedule = require('node-schedule');

var date = new Date();
var d = moment(date).subtract(1, 'month');
d.month();
var billPeriod = d.format('MMMM-YYYY');

var fromDate = moment().subtract(1, 'month').startOf('month').format('DD-MM-YYYY');
var toDate = moment().subtract(1, 'month').endOf('month').format('DD-MM-YYYY');

//Schedule job for generating bills.
var j = schedule.scheduleJob(billGenerationSchedulePeriod, function () {
  axios.post(`${ChargesServiceUrl}/generateBill`, {
    billPeriod: billPeriod,
    fromDate: fromDate,
    toDate: toDate
  }, {
      headers: {
        "X-USER": "SYSTEM",
        "X-IP-HEADER": "127.0.01"
      }
    }).then((res) => {
      debug(res.data);
    }).catch(e => {
      debug(e);
    })
});

//Schedule job for 
var k = schedule.scheduleJob(reattemptSchedulePeriod, function () {
  axios.put(`${ChargesServiceUrl}/reattempt`, {}, {
    headers: {
      "X-USER": "SYSTEM",
      "X-IP-HEADER": "127.0.0.1"
    }
  }).then((res) => {
    debug(res.data);
  }).catch(e => {
    debug(e);
  })
});

const server = http.createServer(app);

server.listen(PORT, () => {
  debug("server started: ", PORT);
  app.emit("application_started");
});

module.exports.app = app;