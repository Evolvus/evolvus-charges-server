var debug = require("debug")("evolvus-charges-server:server");
var moment = require('moment');
var path = require('path');
const _ = require("lodash");
const corporateLinkage = require("@evolvus/evolvus-charges-corporate-linkage");
const glParameters = require("@evolvus/evolvus-charges-gl-parameters");
const billing = require("@evolvus/evolvus-charges-billing");
const axios = require("axios");
var shortid = require('shortid');
const fs = require("fs");

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
  updatedDateAndTime: -1
};
const tenantIdHeader = "X-TENANT-ID";
const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

var attributes = ["corporateName", "utilityCode", "billDate", "billFrequency", "billNumber", "billPeriod", "billStatus", "actualChargesAmount", "actualGSTAmount", "actualTotalAmount", "finalChargesAmount", "finalGSTAmount", "finalTotalAmount", "createdBy", "createdDateAndTime", "updatedBy", "updatedDateAndTime", "processingStatus", "wfInstanceId", "details", "remarks", "reattemptedDateAndTime", "reattemptedStatus", "manualStatusChangeFlag"];
var filterAttributes = ["utilityCode", "billNumber", "billPeriod", "billDate", "billStatus"];

var applicationURL = process.env.CDA_URL || "http://10.10.69.193:3031/chargesTxnDetails";
var timeOut = process.env.TIME_OUT || 5000;
var filePath = process.env.STATIC_FILES_PATH || "/home/user/KAVYAK/CHARGES/GST_REPORT/evolvus-charges-server/routes/api/";

var instance = axios.create({
  baseURL: applicationURL,
  timeout: timeOut,
  params: {}
});

module.exports = (router) => {
  router.route('/billing')
    .post((req, res, next) => {
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
        if (filter.billDate != null) {
          var date = new Date(filter.billDate).toISOString();
          var start = new Date(date);
          start.setHours(0, 0, 0, 0);
          var end = new Date(date);
          end.setHours(23, 59, 59, 999);
          filter.fromDate = start;
          filter.toDate = end;
          delete filter.billDate;
        }
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
          Promise.all([billing.find(filter, orderby, skipCount, limit, ipAddress, createdBy), billing.find(filter, orderby, 0, 0, ipAddress, createdBy)])
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
        debug(`Try-catch failed: ${error}`);
        response.status = "400";
        response.data = error;
        response.description = "Failed to find";
        res.status(400).send(response);
      }
    });

  router.route('/billing/:billNumber')
    .post((req, res, next) => {
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
      const tenantId = req.header(tenantIdHeader);
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
        billing.find({ "billNumber": req.params.billNumber }, {}, 0, 0, ipAddress, createdBy).then((bill) => {
          debug(`Bill workflow update API:Input parameters are: utilityCode:${bill[0].utilityCode},ipAddress:${ipAddress},createdBy:${createdBy},billNumber:${req.params.billNumber},updateObject:${JSON.stringify(body)}`);
          billing.updateWorkflow(bill[0].utilityCode, ipAddress, createdBy, req.params.billNumber, body).then((updatedBill) => {
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
        }).catch((e) => {
          var reference = shortid.generate();
          debug(`Bill update workflow promise failed due to ${e} and referenceId:${reference}`);
          response.status = "400";
          response.description = `Unable to update Bill workflow status due to ${e}`;
          response.data = {};
          res.status(400).json(response);
        })
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
                if (response[0].data.data && response[0].data.data.length > 0) {
                  totalTransactions.push(response[0].data.data[0]);
                  var listOfMandateTxnCodesWithValues = Object.keys(response[0].data.data[0]);
                  var listOfMandateTxnCodesWithoutValues = mandateObject.txnCodes.filter((txnCode) => {
                    if (listOfMandateTxnCodesWithValues.indexOf(txnCode) == -1) {
                      return txnCode;
                    }
                  });
                  listOfMandateTxnCodesWithoutValues.map((mandateTxnCodeWithoutValue) => {
                    totalTransactions[0][mandateTxnCodeWithoutValue] = 0;
                  });
                } else {
                  var alteredMandateObject = {};
                  totalTransactions.push(alteredMandateObject);
                  mandateObject.txnCodes.map((mandateTxnCodeWithoutValue) => {
                    totalTransactions[0][mandateTxnCodeWithoutValue] = 0;
                  });
                }
                if (response[1].data.data && response[1].data.data.length > 0) {
                  totalTransactions.push(response[1].data.data[0]);
                  var listOfPaymentTxnCodesWithValues = Object.keys(response[1].data.data[0]);
                  var listOfPaymentTxnCodesWithoutValues = paymentObject.txnCodes.filter((txnCode) => {
                    if (listOfPaymentTxnCodesWithValues.indexOf(txnCode) == -1) {
                      return txnCode;
                    }
                  });
                  listOfPaymentTxnCodesWithoutValues.map((paymentTxnCodeWithoutValue) => {
                    totalTransactions[1][paymentTxnCodeWithoutValue] = 0;
                  });
                } else {
                  var alteredPaymentObject = {};
                  totalTransactions.push(alteredPaymentObject);
                  paymentObject.txnCodes.map((paymentTxnCodeWithoutValue) => {
                    totalTransactions[1][paymentTxnCodeWithoutValue] = 0;
                  });
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
    .put((req, res, next) =>   {
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

  router.route('/billing/updateWithoutWorkflow/:billNumber')
    .put((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = _.get("X-USER", req.header, "SYSTEM");
      const ipAddress = _.get("X-IP-HEADER", req.header, "127.0.0.1");

      try {
        var object = _.pick(req.body, ["manualStatusChangeFlag", "postingFailureReason","errorCode"]);
        if (_.isEmpty(object)) {
          throw new Error("These attributes cannot be updated");
        } else {
          debug(`Input object is: ${JSON.stringify(object)}`);
          object.updatedBy = createdBy;
          object.updatedDateAndTime = new Date().toISOString();
          billing.updateWithoutWorkflow(req.params.billNumber, object, ipAddress, createdBy).then((result) => {
            debug(`Updated Bill ${req.params.billNumber}`);
            response.data = result;
            response.description = "Updated successfully";
            res.status(200).send(response);
          }).catch(e => {
            debug(`Updating Bill without workflow promise failed: ${e}`);
            response.status = "400";
            response.data = {};
            response.description = e;
            res.status(400).send(response);
          });
        }
      } catch (error) {
        debug(`try-catch promise failed`, error);
        response.status = "400";
        response.data = {};
        response.description = error;
        res.status(400).send(response);
      }
    });

  router.route('/billing/generatePDF')
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = _.get("X-USER", req.header, "SYSTEM");
      const ipAddress = _.get("X-IP-HEADER", req.header, "127.0.0.1");

      try {
        var filterValues = _.pick(req.query, filterAttributes);
        var filter = _.omitBy(req.query, function (value, key) {
          return value.startsWith("undefined") || value.length == 0;
        });
        billing.generatePdf(filter, ipAddress, createdBy)
          .then(findResponse => {
            debug("PDF generated successfully.");
            res.sendFile(findResponse.filename);
          }).catch(e => {
            debug(`Bill PDF generation promise failed: ${e}`);
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

  router.route("/gstreport")
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      const createdBy = req.header(userHeader);
      const ipAddress = req.header(ipHeader);
      try {
        filter = {
          "billPeriod": req.query.billPeriod,
          "processingStatus": "CBS_POSTING_SUCCESSFUL"
        }
        Promise.all([billing.find(filter, ORDER_BY, 0, 0, ipAddress, createdBy), glParameters.find({}, {}, 0, 0, ipAddress, createdBy), corporateLinkage.find({}, {}, 0, 0, ipAddress, createdBy)])
          .then(result => {
            fs.readFile(`${filePath}gst.json`, function (err, data) {
              if (err) {
                response.status = "400";
                response.data = [];
                response.description = `Failed to fetch GST report records due to ${err}`;
                res.status(400).send(response);
              } else {
                var jsonObject = JSON.parse(data.toString());
                calculateGSTReportValues(result[2], result[0], jsonObject).then((result) => {
                  response.status = "200";
                  response.data = result;
                  response.description = `GST Records fetched successfully`;
                  res.status(200).send(response);
                })
              }
            });
          }).catch(error => {
            response.status = "400";
            response.data = error;
            response.description = `Failed to Fetch : ${error.message}`;
            response.totalNoOfRecords = 0;
            response.totalNoOfPages = 0;
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

  router.route("/summaryreport")
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      try {
        const createdBy = req.header(userHeader);
        const ipAddress = req.header(ipHeader);
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
        var sort = _.get(req.query, "sort", {});
        var orderby = sortable(sort);
        Promise.all([billing.find(filter, orderby, 0, 0, ipAddress, createdBy), glParameters.find({}, {}, 0, 0, ipAddress, createdBy), corporateLinkage.find({}, {}, 0, 0, ipAddress, createdBy)])
          .then(result => {
            fs.readFile(`${filePath}summary.json`, function (err, data) {
              if (err) {
                response.status = "400";
                response.data = [];
                response.description = `Failed to fetch Summary report records due to ${err}`;
                res.status(400).send(response);
              } else {
                var jsonObject = JSON.parse(data.toString());
                summaryReport(result[2], result[0], result[1][0].GSTRate, jsonObject).then((result) => {
                  response.status = "200";
                  response.data = result;
                  response.description = `Summary Records fetched successfully`;
                  res.status(200).send(response);
                })
              }
            });
          }).catch(error => {
            response.status = "400";
            response.data = error;
            response.description = `Failed to Fetch : ${error.message}`;
            response.totalNoOfRecords = 0;
            response.totalNoOfPages = 0;
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
};

function calculateGSTReportValues(corporateData, bills, smplGSTRecord) {
  return new Promise((resolve, reject) => {
    var allCrpGSTVal = [];
    var uniqueCorporateIds = _.uniqBy(corporateData, (corporate) => {
      return corporate.tenantId;
    });
    uniqueCorporateIds.map((corporate) => {
      var GSTRecord = _.clone(smplGSTRecord);
      GSTRecord.customerId = corporate.tenantId;
      GSTRecord.accountId = corporate.corporateAccount;
      GSTRecord.gstin = corporate.GSTINnumber;
      GSTRecord.customerName = corporate.corporateName;
      GSTRecord.transactionPricedCharge = 0;
      GSTRecord.taxAmount = 0;
      var curCrpBills = [];
      curCrpBills = bills.filter((bill) => {
        return bill.tenantId == corporate.tenantId;
      });
      curCrpBills.map((curCrpBill) => {
        GSTRecord.transactionPricedCharge = GSTRecord.transactionPricedCharge + curCrpBill.finalChargesAmount;
        GSTRecord.taxAmount = GSTRecord.taxAmount + curCrpBill.finalGSTAmount;
      });
      allCrpGSTVal.push(GSTRecord);
    });
    resolve(allCrpGSTVal);
  });
}


function summaryReport(corporateData, bills, gstRate, reportObject) {
  return new Promise((resolve, reject) => {
    var reports = [];
    var object = {};
    var gst = (gstRate / 2).toFixed(2);
    corporateData.map((corporate) => {
      object[`${corporate.utilityCode}`] = corporate.corporateAccount;
    });
    var details = {};
    bills.map((bill) => {
      bill.details.map((element) => {
        details[`${element.name}.rate`] = element.rate;
        details[`${element.name}.transactions`] = element.transactions;
      });            
      var report = _.clone(reportObject);      
      report["Utility Code"] = bill.utilityCode;
      report["Customer Name"] = bill.corporateName;
      report["Account Number"] = object[bill.utilityCode];
      report["Bill Number"] = bill.billNumber;
      report["Bill Date"] = bill.billDate.toUTCString();
      report["Bill Period"] = bill.billPeriod;
      report["Bill Status"] = bill.billStatus;
      report["Bulk Mandate Creation charges/Transaction"] = isNullOrUndefined(details['Bulk Mandate Creation.rate']) ? details['Bulk Mandate Creation.rate'] : 'NA';
      report["Bulk Mandate Creation Transactions"] = isNullOrUndefined(details['Bulk Mandate Creation.transactions']) ? details['Bulk Mandate Creation.transactions'] : 'NA';
      report["Single Paper Mandate Creation charges/Transaction"] = isNullOrUndefined(details['Single Paper Mandate Creation.rate']) ? details['Single Paper Mandate Creation.rate'] : 'NA';
      report["Single Paper Mandate Creation Transactions"] = isNullOrUndefined(details['Single Paper Mandate Creation.transactions']) ? details['Single Paper Mandate Creation.transactions'] : 'NA';
      report["Single Paper Mandate Amendment charges/Transaction"] = isNullOrUndefined(details['Single Paper Mandate Amendment.rate']) ? details['Single Paper Mandate Amendment.rate'] : 'NA';
      report["Single Paper Mandate Amendment Transactions"] = isNullOrUndefined(details['Single Paper Mandate Amendment.transactions']) ? details['Single Paper Mandate Amendment.transactions'] : 'NA';
      report["Single Paper Mandate Cancelation charges/Transaction"] = isNullOrUndefined(details['Single Paper Mandate Cancelation.rate']) ? details['Single Paper Mandate Cancelation.rate'] : 'NA';
      report["Single Paper Mandate CancelationTransactions"] = isNullOrUndefined(details['Single Paper Mandate Cancelation.transactions']) ? details['Single Paper Mandate Cancelation.transactions'] : 'NA';
      report["Bulk Mandate Amendment charges/Transaction"] = isNullOrUndefined(details['Bulk Mandate Amendment.rate']) ? details['Bulk Mandate Amendment.rate'] : 'NA';
      report["Bulk Mandate Amendment Transactions"] = isNullOrUndefined(details['Bulk Mandate Amendment.transactions']) ? details['Bulk Mandate Amendment.transactions'] : 'NA';
      report["Bulk Mandate Cancelation charges/Transaction"] = isNullOrUndefined(details['Bulk Mandate Cancelation.rate']) ? details['Bulk Mandate Cancelation.rate'] : 'NA';
      report["Bulk Mandate Cancelation Transactions"] = isNullOrUndefined(details['Bulk Mandate Cancelation.transactions']) ? details['Bulk Mandate Cancelation.transactions'] : 'NA';
      report["Single Paper Mandate Creation-ONUS charges/Transaction"] = isNullOrUndefined(details['Single Paper Mandate Creation-ONUS.rate']) ? details['Single Paper Mandate Creation-ONUS.rate'] : 'NA';
      report["Single Paper Mandate Creation-ONUS Transactions"] = isNullOrUndefined(details['Single Paper Mandate Creation-ONUS.transactions']) ? details['Single Paper Mandate Creation-ONUS.transactions'] : 'NA';
      report["Single Paper Mandate Amendment-ONUS charges/Transaction"] = isNullOrUndefined(details['Single Paper Mandate Amendment-ONUS.rate']) ? details['Single Paper Mandate Amendment-ONUS.rate'] : 'NA';
      report["Single Paper Mandate Amendment-ONUS Transactions"] = isNullOrUndefined(details['Single Paper Mandate Amendment-ONUS.transactions']) ? details['Single Paper Mandate Amendment-ONUS.transactions'] : 'NA';
      report["Single Paper Mandate Cancellation-ONUS charges/Transaction"] = isNullOrUndefined(details['Single Paper Mandate Cancellation-ONUS.rate']) ? details['Single Paper Mandate Cancellation-ONUS.rate'] : 'NA';
      report["Single Paper Mandate Cancellation-ONUS Transactions"] = isNullOrUndefined(details['Single Paper Mandate Cancellation-ONUS.transactions']) ? details['Single Paper Mandate Cancellation-ONUS.transactions'] : 'NA';
      report["Bulk Mandate Creation-ONUS charges/Transaction"] = isNullOrUndefined(details['Bulk Mandate Creation-ONUS.rate']) ? details['Bulk Mandate Creation-ONUS.rate'] : 'NA';
      report["Bulk Mandate Creation-ONUS Transactions"] = isNullOrUndefined(details['Bulk Mandate Creation-ONUS.transactions']) ? details['Bulk Mandate Creation-ONUS.transactions'] : 'NA';
      report["Bulk Mandate Amendment-ONUS charges/Transaction"] = isNullOrUndefined(details['Bulk Mandate Amendment-ONUS.rate']) ? details['Bulk Mandate Amendment-ONUS.rate'] : 'NA';
      report["Bulk Mandate Amendment-ONUS Transactions"] = isNullOrUndefined(details['Bulk Mandate Amendment-ONUS.transactions']) ? details['Bulk Mandate Amendment-ONUS.transactions'] : 'NA';
      report["Bulk Mandate Cancellation-ONUS charges/Transaction"] = isNullOrUndefined(details['Bulk Mandate Cancellation-ONUS.rate']) ? details['Bulk Mandate Cancellation-ONUS.rate'] : 'NA';
      report["Bulk Mandate Cancellation-ONUS Transactions"] = isNullOrUndefined(details['Bulk Mandate Cancellation-ONUS.transactions']) ? details['Bulk Mandate Cancellation-ONUS.transactions'] : 'NA';
      report["Auto Reattempt of Payment charges/Transaction"] = isNullOrUndefined(details['Auto Reattempt of Payment.rate']) ? details['Auto Reattempt of Payment.rate'] : 'NA';
      report["Auto Reattempt of Payment Transactions"] = isNullOrUndefined(details['Auto Reattempt of Payment.transactions']) ? details['Auto Reattempt of Payment.transactions'] : 'NA';
      report["Bulk Payment Creation charges/Transaction"] = isNullOrUndefined(details['Bulk Payment Creation.rate']) ? details['Bulk Payment Creation.rate'] : 'NA';
      report["Bulk Payment Creation Transactions"] = isNullOrUndefined(details['Bulk Payment Creation.transactions']) ? details['Bulk Payment Creation.transactions'] : 'NA';
      report["Auto Collection of Payment charges/Transaction"] = isNullOrUndefined(details['Auto Collection of Payment.rate']) ? details['Auto Collection of Payment.rate'] : 'NA';
      report["Auto Collection of Payment Transactions"] = isNullOrUndefined(details['Auto Collection of Payment.transactions']) ? details['Auto Collection of Payment.transactions'] : 'NA';
      report["Total"] = bill.finalChargesAmount;
      report[`CGST@${gst}%`] = bill.finalGSTAmount / 2;
      report[`SGST@${gst}%`] = bill.finalGSTAmount / 2;
      report["Total Charges"] = bill.finalTotalAmount;
      reports.push(report);
    });
    resolve(reports);
  });
}

function isNullOrUndefined(input) {
  if (input != null || input === 0) return true;
  else return false;
}

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
