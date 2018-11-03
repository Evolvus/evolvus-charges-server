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

app.use(function(req, res, next) {
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

var toDate = moment(date).format("DD-MM-YYYY");
date.setMonth(date.getMonth() - 1);
var fromDate = moment(date).format("DD-MM-YYYY");

var j = schedule.scheduleJob('30 * * * * * ', function() {
  axios.post("http://192.168.1.18:9292/api/generateBill", {
    billPeriod: billPeriod,
    fromDate: fromDate,
    toDate: toDate
  }, {
    headers: {
      "X-USER": "SYSTEM",
      "X-IP-HEADER": "192.168.1.100"
    }
  }).then((res) => {
    debug(res.data);
  }).catch(e => {
    debug(e);
  })
});

const server = http.createServer(app);

server.listen(PORT,"192.168.0.101",() => {
  debug("server started: ", PORT);
  app.emit("application_started");
});

module.exports.app = app;