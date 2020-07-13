var debug = require("debug")("evolvus-charges-server:server");
var corporateLinkage = require("@evolvus/evolvus-charges-corporate-linkage");
const _ = require("lodash");
const axios = require("axios");
const shortid = require("shortid");

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
  updatedDateAndTime: -1
};
const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";
const tenantHeader = "X-TENANT-ID";

var corporateURL = process.env.CORPORATE_URL || "http://10.10.69.193:3031/corporateUtilityCodes";

var attributes = ["corporateName", "tenantId", "utilityCode", "chargePlan", "corporateAccount", "billingAddress", "emailId", "GSTINnumber","returnCharges", "createdBy", "createdDateAndTime", "updatedBy", "updatedDateAndTime"];
var filterAttributes = ["corporateName", "utilityCode", "chargePlan","processingStatus", "activationStatus"]

var instance = axios.create({
  baseURL: corporateURL,
  timeout: 5000
});

module.exports = (router) => {
  router.route('/corporateLinkage')
    .post((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const tenantId = req.header(tenantHeader);
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {        
        instance.get(corporateURL).then((resp) => {
          if (resp.data && resp.data.data) {
            var selectedUtility = resp.data.data.filter((corporateData) => {
              return corporateData.corporateName == req.body.corporateName
            }).filter((selectedCorporate) => {
              return selectedCorporate.achCode == req.body.utilityCode
            });
            if (selectedUtility.length != 0) {
              var object = _.pick(req.body, attributes);
              debug(`Input object is: ${JSON.stringify(object)}`);
              object.tenantId = tenantId;
              object.createdBy = createdBy;
              object.createdDateAndTime = new Date().toISOString();
              object.updatedBy = object.createdBy;
              object.updatedDateAndTime = object.createdDateAndTime;
             // object.tenantId = selectedUtility[0].tenantId;
             corporateLinkage.save(tenantId, object, ipAddress, createdBy).then((result) => {
              response.data = result;
                response.description = `Saved successfully`;
                res.status(200).send(response);
              }).catch(e => {
                debug(`Saving GL parameters promise failed: ${e}`);
                response.status = "400";
                response.data = {};
                response.description = e.toString();
                res.status(400).send(response);
              });
            } else {
              throw new Error(`${req.body.corporateName} Corporate not found matching the Utility code ${req.body.utilityCode}`);
            }
          } else {
            throw new Error("Server error.Please contact Administrator.");
          }
        }).catch((e) => {
          debug(`Fetching corporate details promise failed: ${e}`);
          response.status = "400";
          response.data = {};
          response.description = e.toString();
          res.status(400).send(response);
        });
      } catch (error) {
        debug(`Try-catch failed: ${error}`);
        response.status = "400";
        response.data = {};
        response.description = error;
        res.status(400).send(response);
      }
    })
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: [],
        description: ""
      };
      // const createdBy = req.header(userHeader);
      // const ipAddress = req.header(ipHeader);
      try {
        // var limit = _.get(req.query, "limit", LIMIT);
        // var skipCount = 0;
        // var sort = _.get(req.query, "sort", {});
        // var orderby = sortable(sort);
        // var filterValues = _.pick(req.query, filterAttributes);
        // var filter = _.omitBy(filterValues, function(value, key) {
        //   return value.startsWith("undefined") || value.length == 0;
        // });
        // corporateLinkage.find(filter, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
        var createdBy = req.header(userHeader);
        var ipAddress = req.header(ipHeader);
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
        var filter = _.omitBy(filterValues, function (value, key) {
          return value.startsWith("undefined") || value.length == 0;
        });
        var invalidFilters = _.difference(_.keys(req.query), filterAttributes);
        let a = _.pull(invalidFilters, 'pageSize', 'pageNo', 'limit', 'sort', 'query');
        // debug("invalidFilters:", invalidFilters);
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
          Promise.all([corporateLinkage.find(filter, orderby, skipCount, limit, ipAddress, createdBy), corporateLinkage.find(filter, orderby, 0, 0, ipAddress, createdBy)])
            .then(findResponse => {
              response.status = "200";
              response.data = findResponse[0];
              response.description = `Found ${findResponse[0].length} Charge Code/s`;
              response.totalNoOfPages = Math.ceil(findResponse[1].length / pageSize);
              response.totalNoOfRecords = findResponse[1].length;
              res.status(200).send(response);
            }).catch(error => {
              response.status = "400";
              response.data = error;
              response.description = `Failed to Fetch : ${error.message}`;
              response.totalNoOfRecords = 0;
              response.totalNoOfPages = 0;
              res.status(400).send(response);
            });
          }
        } catch (error) {
          response.status = "400";
          response.data = error;
          response.description = "Failed to fetch corporate linkage records.";
          res.status(400).send(response);
        }
      });

  router.route('/corporateLinkageUtilityCodes')
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: [],
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var limit = _.get(req.query, "limit", LIMIT);
        var skipCount = 0;
        var sort = _.get(req.query, "sort", {});
        var orderby = sortable(sort);
        var filterValues = _.pick(req.query, filterAttributes);
        var filter = _.omitBy(filterValues, function (value, key) {
          return value.startsWith("undefined");
        });
        corporateLinkage.find(filter, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
          let unique = [...new Set(result.map(item => item.utilityCode))];
          response.description = "";
          response.data = unique;
          res.status(200).send(response);
        }).catch(e => {
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to fetch corporate linkage records.";
          res.status(400).send(response);
        });
      } catch (error) {
        response.status = "400";
        response.data = error;
        response.description = "Failed to fetch corporate linkage records.";
        res.status(400).send(response);
      }
    });

  router.route('/corporateLinkageChargePlans')
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: [],
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var limit = _.get(req.query, "limit", LIMIT);
        var skipCount = 0;
        var sort = _.get(req.query, "sort", {});
        var orderby = sortable(sort);
        var filterValues = _.pick(req.query, filterAttributes);
        var filter = _.omitBy(filterValues, function (value, key) {
          return value.startsWith("undefined");
        });
        corporateLinkage.find(filter, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
          let unique = [...new Set(result.map(item => item.chargePlan))];
          response.description = "";
          response.data = unique;
          res.status(200).send(response);
        }).catch(e => {
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to fetch corporate linkage records.";
          res.status(400).send(response);
        });
      } catch (error) {
        response.status = "400";
        response.data = error;
        response.description = "Failed to fetch corporate linkage records.";
        res.status(400).send(response);
      }
    });

  router.route('/corporateLinkage/:utilityCode')
    .put((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const tenantId = req.header(tenantHeader);
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var object = _.pick(req.body, attributes);
        debug(`Input object is: ${JSON.stringify(object)}`);
        object.updatedBy = createdBy;
        object.updatedDateAndTime = new Date().toISOString();
        corporateLinkage.update(tenantId,req.params.utilityCode, object, ipAddress, createdBy).then((result) => {
          response.data = result;
          response.description = `Corporate Linkage ${req.params.utilityCode} Updated successfully`;
          res.status(200).send(response);
        }).catch((e) => {
          debug(`Update CorporateLinkage promise failed: ${e}`);
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to Update";
          res.status(400).send(response);
        });
      } catch (e) {
        response.status = "400";
        response.data = e;
        response.description = "Failed to Update CorporateLinkage.";
        res.status(400).send(response);
      }
    });


router.route("/private/api/chargeLinkage/:id")
.put((req, res, next) => {
  const tenantId = req.header(tenantHeader);
  const createdBy = req.header(userHeader);
  const ipAddress = req.header(ipHeader);
  const response = {
    "status": "200",
    "description": "",
    "data": []
  };
  debug("query: " + JSON.stringify(req.query));
  try {
    let body = _.pick(req.body, filterAttributes);
    body.updatedBy = req.header(userHeader);
    body.lastUpdatedDate = new Date().toISOString();
    debug(`user workflow update API:Input parameters are: tenantId:${tenantId},ipAddress:${ipAddress},createdBy:${createdBy},id:${req.params.id},updateObject:${JSON.stringify(body)}`);
    corporateLinkage.updateWorkflow(tenantId, ipAddress, createdBy, req.params.id, body).then((updatedUser) => {
      response.status = "200";
      response.description = `${req.params.id} User workflow status has been updated successfully `;
      response.data = body;
      res.status(200).json(response);
    }).catch((e) => {
      var reference = shortid.generate();
      debug(`user update workflow promise failed due to ${e} and referenceId:${reference}`);
      response.status = "400";
      response.description = `Unable to update User workflow status due to ${e}`;
      response.data = e.toString()
      res.status(400).json(response);
    });
  } catch (e) {
    var reference = shortid.generate();
    debug(`try catch promise failed due to ${e} and referenceId:${reference}`);
    response.status = "400";
    response.description = `Unable to update User workflow status due to ${e}`;
    response.data = e.toString();
    res.status(400).json(response);
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
