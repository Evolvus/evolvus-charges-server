var debug = require("debug")("evolvus-charges-server:server");
var moment = require('moment');

// var billing = require("@evolvus/evolvus-charges-billing");
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
const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

var attributes = ["corporateName", "utilityCode", "billDate", "billFrequency", "billNumber", "billPeriod", "actualChargesAmount", "actualGSTAmount", "actualTotalAmount", "finalChargesAmount", "finalGSTAmount", "finalTotalAmount", "createdBy", "createdDateAndTime", "updatedBy", "updatedDateAndTime"];
var filterAttributes = ["corporateName", "utilityCode", "chargePlan"];

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
        })
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
                billing.find(filter, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
                    response.description = "";
                    response.data = result;
                    res.status(200).send(response);
                }).catch(e => {
                    response.status = "400";
                    response.data = e.toString();
                    response.description = "Failed to fetch Bills.";
                    res.status(400).send(response);
                });
            } catch (error) {
                response.status = "400";
                response.data = error;
                response.description = "Failed to fetch Bills";
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
            const createdBy = req.header(userHeader);
            const ipAddress = req.header(ipHeader);
            try {
                var object = _.pick(req.body, attributes);
                debug(`Input object is: ${JSON.stringify(object)}`);
                object.updatedBy = createdBy;
                object.updatedDateAndTime = new Date().toISOString();

                glParameters.update(req.params.billNumber, object, ipAddress, createdBy).then((result) => {
                    response.data = result;
                    response.description = "Updated successfully";
                    res.status(200).send(response);
                }).catch(e => {
                    debug(`Updating GL parameters promise failed: ${e}`);
                    response.status = "400";
                    response.data = e.toString();
                    response.description = "Failed to update";
                    res.status(400).send(response);
                });

            } catch (error) {
                response.status = "400";
                response.data = error;
                response.description = "Failed to fetch Gl Parameters.";
                res.status(400).send(response);
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

                            var date = new Date();
                            var toDate = moment(date).format("DD-MM-YYYY");
                            date.setMonth(date.getMonth() - 1);
                            var fromDate = moment(date).format("DD-MM-YYYY");

                            let mandateObject = {
                                txnCodes: mandateTransactionTypes,
                                utilityCode: corporate.utilityCode,
                                fromDate: fromDate,
                                toDate: toDate,
                                tenantId: corporate.tenantId,
                                requestType: "MANDATE"
                            };
                            debug(`Mandate object for utilityCode ${corporate.utilityCode} is ${JSON.stringify(mandateObject)}`);
                            let paymentObject = {
                                txnCodes: paymentTransactionTypes,
                                utilityCode: corporate.utilityCode,
                                fromDate: fromDate,
                                toDate: toDate,
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

                                billing.generateBill(corporate, totalTransactions, createdBy, ipAddress).then((responseFromMethod) => {
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
                    }
                    else {
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