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
        var limit = _.get(req.query, "limit", LIMIT);
        limit = parseInt(limit);
        if (isNaN(limit)) {
          throw new Error("limit must be a number");
        }
        var pageSize = _.get(req.query, "pageSize", PAGE_SIZE);
        pageSize = parseInt(pageSize);
        if (isNaN(pageSize)) {
          throw new Error("pageSize must be a number");
        }
        var pageNo = _.get(req.query, "pageNo", 1);
        pageNo = parseInt(pageNo);
        if (isNaN(pageNo)) {
          throw new Error("pageNo must be a number");
        }
        var skipCount = pageSize * (pageNo - 1);
        if (skipCount < 0) {
          throw new Error("skipCount must be positive value or 0");
        }
        var filterValues = _.pick(req.query, filterAttributes);
        var filter = _.omitBy(filterValues, function(value, key) {
          return value.startsWith("undefined") || value.length == 0;
        });
        var invalidFilters = _.difference(_.keys(req.query), filterAttributes);
        let a = _.pull(invalidFilters, 'pageSize', 'pageNo', 'limit', 'sort', 'query');
        debug("invalidFilters:", invalidFilters);
        if (a.length !== 0) {
          response.status = "200";
          response.description = "No ChargeCodes found";
          response.data = [];
          response.totalNoOfPages = 0;
          response.totalNoOfRecords = 0;
          res.json(response);
        } else {
          var sort = _.get(req.query, "sort", {});
          var orderby = sortable(sort);
          limit = (+pageSize < +limit) ? pageSize : limit;
          Promise.all([chargePlan.find(filter, orderby, skipCount, limit, ipAddress, createdBy), chargePlan.find(filter, orderby, 0, 0, ipAddress, createdBy)]).then((result) => {
            if (result.length > 0) {
              response.data = result[0];
              response.description = "SUCCESS";
              response.totalNoOfPages = Math.ceil(result[1].length / pageSize);
              response.totalNoOfRecords = result[1].length;
              res.status(200).send(response);
            } else {
              response.data = [];
              response.description = "No ChargePlan Found";
              response.totalNoOfRecords = 0;
              response.totalNoOfPages = 0;
              res.status(200).send(response);
            }
          }).catch(e => {
            debug(`Finding chargePlan promise failed: ${e}`);
            response.status = "400";
            response.data = e.toString();
            response.description = "Failed to find chargePlan";
            res.status(400).send(response);
          });
        }
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
          response.description = `ChargePlan ${req.params.name} Updated successfully`;
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
