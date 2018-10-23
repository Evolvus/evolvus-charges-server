const PORT = process.env.PORT || 9292;
/*
 ** Get all the required libraries
 */

const http = require("http");


const debug = require("debug")("evolvus-charges-server:server");
const express = require("express");
const bodyParser = require("body-parser");
const connection = require("@evolvus/evolvus-mongo-dao").connection;

const app = express();
const router = express.Router();

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

const server = http.createServer(app);

server.listen(PORT, () => {
  debug("server started: ", PORT);
  app.emit("application_started");
});

module.exports.app = app;