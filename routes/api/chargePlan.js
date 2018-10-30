var debug = require("debug")("evolvus-charges-server:server");
var chargePlan = require("@evolvus/evolvus-charges-charge-plan");
// var schemeType = require("@evolvus/evolvus-charges-scheme-type");

const _ = require("lodash");

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
  updatedDateAndTime: -1
};
const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

var chargePlanAttributes = ["name", "chargeCodes", "createdBy", "createdDateAndTime", "updatedBy", "updatedDateAndTime"];
var filterAttributes = ["name", "chargeCodes"];

module.exports = (router) => {
  router.route('/chargePlan')
    .post((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var object = _.pick(req.body, chargePlanAttributes);
        debug(`Input object is: ${JSON.stringify(object)}`);
        object.createdBy = createdBy;
        object.createdDateAndTime = new Date().toISOString();
        object.updatedBy = object.createdBy;
        object.updatedDateAndTime = object.createdDateAndTime;
        chargePlan.save(object, ipAddress, createdBy).then((result) => {
          response.data = result;
          response.description = "Saved successfully";
          res.status(200).send(response);
        }).catch((e) => {
          debug(`Saving chargePlan promise failed: ${e}`);
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to save";
          res.status(400).send(response);
        });
      } catch (error) {
        debug(`Try-catch failed: ${error}`);
        response.status = "400";
        response.data = error;
        response.description = "Failed to save";
        res.status(400).send(response);
      }
    });

  router.route('/chargePlan')
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var filterValues = _.pick(req.query, filterAttributes);
        var filter = _.omitBy(filterValues, function(value, key) {
          return value.startsWith("undefined");
        });
        var limit = _.get(req.query, "limit", LIMIT);
        var skipCount = 0;
        var sort = _.get(req.query, "sort", {});
        var orderby = sortable(sort);
        chargePlan.find(filter, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
          if (result.length > 0) {
            response.data = result;
            response.description = "SUCCESS";
            res.status(200).send(response);
          } else {
            response.data = [];
            response.description = "No ChargePlan Found";
            res.status(200).send(response);
          }
        }).catch(e => {
          debug(`Finding chargePlan promise failed: ${e}`);
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to find chargePlan";
          res.status(400).send(response);
        });
      } catch (error) {
        debug(`Try-catch failed: ${error}`);
        response.status = "400";
        response.data = error;
        response.description = "Failed to find";
        res.status(400).send(response);
      }
    });

  router.route('/chargePlan/:name')
    .put((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var object = _.pick(req.body, chargePlanAttributes);
        debug(`Input object is: ${JSON.stringify(object)}`);
        object.updatedBy = createdBy;
        object.updatedDateAndTime = new Date().toISOString();
        chargePlan.update(req.params.name, object, ipAddress, createdBy).then((result) => {
          response.data = result;
          response.description = "Updated successfully";
          res.status(200).send(response);
        }).catch(e => {
          debug(`Updating ChargePlan promise failed: ${e}`);
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to update";
          res.status(400).send(response);
        });
      } catch (e) {
        response.status = "400";
        response.data = e;
        response.description = "Failed to update chargePlan.";
        res.status(400).send(response);
      }
    });
};

function sortable(sort) {
  if (typeof sort === 'undefined' ||
    sort == null) {
    return ORDER_BY;
  }
  if (typeof sort === 'string') {
    var values = sort.split(",");
    var result = sort.split(",")
      .reduce((temp, sortParam) => {
        if (sortParam.charAt(0) == "-") {
          return _.assign(temp, _.fromPairs([
            [sortParam.replace(/-/, ""), -1]
          ]));
        } else {
          return _.assign(_.fromPairs([
            [sortParam.replace(/\ /, ""), 1]
          ]));
        }
      }, {});
    return result;
  } else {
    return ORDER_BY;
  }
}