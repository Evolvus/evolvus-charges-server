var debug = require("debug")("evolvus-charges-server:server");
var moment = require('moment');

const _ = require("lodash");
const corporateLinkage = require("@evolvus/evolvus-charges-corporate-linkage");
const billing = require("@evolvus/evolvus-charges-billing");
const axios = require("axios");
var shortid = require('shortid');

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
  updatedDateAndTime: -1
};
const utilityCodeHeader = "X-TENANT-ID";
const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

var attributes = ["corporateName", "utilityCode", "billDate", "billFrequency", "billNumber", "billPeriod", "billStatus", "actualChargesAmount", "actualGSTAmount", "actualTotalAmount", "finalChargesAmount", "finalGSTAmount", "finalTotalAmount", "createdBy", "createdDateAndTime", "updatedBy", "updatedDateAndTime", "processingStatus", "wfInstanceId", "details", "remarks"];
var filterAttributes = ["utilityCode", "billNumber", "billPeriod", "billDate", "billStatus"];

var applicationURL = process.env.CDA_URL || "http://10.10.69.193:3031/chargesTxnDetails";
var timeOut = process.env.TIME_OUT || 5000;

var instance = axios.create({
  baseURL: applicationURL,
  timeout: timeOut,
  params: {}
});

module.exports = (router) => {
  router.route('/billing')
    .post((req, finalResponse, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        var object = _.pick(req.body, attributes);
        debug(`Input object is: ${JSON.stringify(object)}`);
        object.createdBy = createdBy;
        object.createdDateAndTime = new Date().toISOString();
        object.updatedBy = object.createdBy;
        object.updatedDateAndTime = object.createdDateAndTime;
        billing.save(object, ipAddress, createdBy).then((result) => {
          response.data = result;
          response.description = `Saved Bill ${result.billNumber} successfully`;
          res.status(200).send(response);
        }).catch(e => {
          debug(`Saving Bill promise failed: ${e}`);
          response.status = "400";
          response.data = {};
          response.description = e.toString();
          res.status(400).send(response);
        });
      } catch (error) {
        debug(`Try-catch failed: ${error}`);
        response.status = "400";
        response.data = {};
        response.description = e.toString();
        res.status(400).send(response);
      }
    });

  router.route("/billing")
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
        var filter = _.omitBy(req.query, function (value, key) {
          return value.startsWith("undefined") || value.length == 0;
        });
        var invalidFilters = _.difference(_.keys(req.query), filterAttributes);
        let a = _.pull(invalidFilters, 'fromDate', 'toDate', 'pageSize', 'pageNo', 'limit', 'sort', 'query');
        debug("invalidFilters:", invalidFilters);
        if (a.length !== 0) {
          response.status = "200";
          response.description = "No Billings found";
          response.data = [];
          response.totalNoOfPagses = 0;
          response.totalNoOfRecords = 0;
          res.json(response);
        } else {
          var sort = _.get(req.query, "sort", {});
          var orderby = sortable(sort);
          limit = (+pageSize < +limit) ? pageSize : limit;
          billing.find(filter, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
            if (result.length > 0) {
              response.data = result;
              response.description = "SUCCESS";
              response.totalNoOfPages = Math.ceil(result.length / pageSize);
              response.totalNoOfRecords = result.length;
              res.status(200).send(response);
            } else {
              response.data = [];
              response.description = "No Billings Found";
              response.totalNoOfRecords = 0;
              response.totalNoOfPages = 0;
              res.status(200).send(response);
            }
          }).catch(e => {
            debug(`Finding Billing promise failed: ${e}`);
            response.status = "400";
            response.data = e.toString();
            response.description = "Failed to find billing";
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

  router.route('/billing/:billNumber')
    .put((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = _.get("X-USER", req.header, "SYSTEM");
      const ipAddress = _.get("X-IP-HEADER", req.header, "127.0.0.1");

      try {
        var object = _.pick(req.body.bill, attributes);
        debug(`Input object is: ${JSON.stringify(object)}`);
        object.updatedBy = createdBy;
        object.updatedDateAndTime = new Date().toISOString();
        object.billStatus = "PENDING_AUTHORIZATION";
        billing.update(req.params.billNumber, object, ipAddress, createdBy).then((result) => {
          debug(`Updated Bill ${req.params.billNumber}`);
          response.data = result;
          response.description = "Updated successfully";
          res.status(200).send(response);
        }).catch(e => {
          debug(`Updating Bill promise failed: ${e}`);
          response.status = "400";
          response.data = {};
          response.description = e;
          res.status(400).send(response);
        });

      } catch (error) {
        debug(`try-catch promise failed`, error);
        response.status = "400";
        response.data = {};
        response.description = error;
        res.status(400).send(response);
      }
    });

  router.route("/private/api/billing/:billNumber")
    .put((req, res, next) => {
      const utilityCode = req.header(utilityCodeHeader);
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      const response = {
        "status": "200",
        "description": "",
        "data": []
      };
      try {
        let body = _.pick(req.body, attributes);
        body.updatedBy = createdBy;
        body.lastUpdatedDate = new Date().toISOString();
        debug(`Bill workflow update API:Input parameters are: utilityCode:${utilityCode},ipAddress:${ipAddress},createdBy:${createdBy},billNumber:${req.params.billNumber},updateObject:${JSON.stringify(body)}`);
        billing.updateWorkflow(utilityCode, ipAddress, createdBy, req.params.billNumber, body).then((updatedBill) => {
          response.status = "200";
          response.description = `${req.params.billNumber} Bill workflow status has been updated successfully `;
          response.data = body;
          res.status(200).json(response);
        }).catch((e) => {
          var reference = shortid.generate();
          debug(`Bill update workflow promise failed due to ${e} and referenceId:${reference}`);
          response.status = "400";
          response.description = `Unable to update Bill workflow status due to ${e}`;
          response.data = {};
          res.status(400).json(response);
        });
      } catch (e) {
        var reference = shortid.generate();
        debug(`try catch promise failed due to ${e} and referenceId:${reference}`);
        response.status = "400";
        response.description = `Unable to update User workflow status due to ${e}`;
        response.data = {};
        res.status(400).json(response);
      }
    });

  router.route("/generateBill")
    .post((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        debug("Bill generation Initiated.");
        let generatedBills = [];
        corporateLinkage.find({}, {}, 0, 0, ipAddress, createdBy).then(corporates => {
          debug(`Number of corporates found is: ${corporates.length}`);
          if (corporates.length > 0) {
            Promise.all(corporates.map(corporate => {

              var mandateTransactionTypes = corporate.chargePlan.chargeCodes.filter((chargeCode) => {
                return chargeCode.transactionType.type == "MANDATE"
              }).map((chargeCode) => {
                return chargeCode.transactionType.code;
              });

              var paymentTransactionTypes = corporate.chargePlan.chargeCodes.filter((chargeCode) => {
                return chargeCode.transactionType.type == "PAYMENT"
              }).map((chargeCode) => {
                return chargeCode.transactionType.code;
              });

              let mandateObject = {
                txnCodes: mandateTransactionTypes,
                utilityCode: corporate.utilityCode,
                fromDate: req.body.fromDate,
                toDate: req.body.toDate,
                tenantId: corporate.tenantId,
                requestType: "MANDATE"
              };
              debug(`Mandate object for utilityCode ${corporate.utilityCode} is ${JSON.stringify(mandateObject)}`);
              let paymentObject = {
                txnCodes: paymentTransactionTypes,
                utilityCode: corporate.utilityCode,
                fromDate: req.body.fromDate,
                toDate: req.body.toDate,
                tenantId: corporate.tenantId,
                requestType: "PAYMENT"
              };
              debug(`Payment object for utilityCode ${corporate.utilityCode} is ${JSON.stringify(paymentObject)}`);
              Promise.all([axios.post(applicationURL, mandateObject), axios.post(applicationURL, paymentObject)]).then((response) => {
                let totalTransactions = [];
                if (response[0].data.data) {
                  totalTransactions.push(response[0].data.data[0]);
                }
                if (response[1].data.data) {
                  totalTransactions.push(response[1].data.data[0]);
                }

                debug(`Total transaction codes available for utilityCode ${corporate.utilityCode} are ${JSON.stringify(totalTransactions)}`);

                billing.generateBill(corporate, totalTransactions, req.body.billPeriod, createdBy, ipAddress).then((responseFromMethod) => {
                  var responseObject = {};
                  responseObject.details = `Bill Generated : Bill Number = ${responseFromMethod.billNumber}`;
                  responseObject.status = "Bill Generated Successfully";
                  generatedBills.push(responseObject);
                });
              }).catch(e => {
                debug(`Failed to fetch transaction details`, e);
                response.status = "400";
                response.data = {};
                response.description = `Failed to fetch transaction details`;
              });

            })).then((result) => {
              var responseToScheduler = {};
              responseToScheduler.data = `${generatedBills.length} bills generated successfully!`;
              responseToScheduler.details = generatedBills;
              response.data = {};
              response.description = "Bill generation Initiated";
              response.status = "200";
              res.json(response);
            }).catch((e) => {
              debug(`Error while iterating corporates`, e);
              res.status(400).send(e);
            });
          } else {
            debug(`No corporates Found`);
            response.data = {};
            response.description = "No corporate details found";
            response.status = "200";
            res.json(response);
          }
        });

      } catch (error) {
        debug(`Failed generating Bills`, error);
        response.status = "400";
        response.data = error;
        response.description = "Failed generating Bills";
        res.status(400).send(response);
      }
    });

  router.route('/reattempt')
    .put((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      var start = moment().startOf('day').toISOString();
      var end = moment().endOf('day').toISOString();
      let filterBills = {
        "billStatus": "CBS_POSTING_FAILURE",
        "reattemptFlag": "NO",
        "reattemptDate": {
          $gte: start,
          $lt: end
        }
      }
      billing.find(filterBills, {}, 0, 0, ipAddress, createdBy).then((bills) => {
        if (bills.length > 0) {
          Promise.all(bills.map(bill => {
            billing.reattempt(bill, createdBy, ipAddress).then(resp => {
              debug(resp);
            }).catch(e => {
              debug(e)
            });
          })).then(() => {
            response.data = {};
            response.description = "Rettempt service Initiated";
            response.status = "200";
            res.json(response);
          });
        } else {
          debug(`No Bills Found`);
          response.data = {};
          response.description = "No Bills found";
          response.status = "200";
          res.json(response);
        }

      })
    })

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