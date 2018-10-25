var debug = require("debug")("evolvus-charges-server:server");
var corporateLinkage = require("@evolvus/evolvus-charges-corporate-linkage");
const _ = require("lodash");
const axios = require("axios");

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
    updatedDateAndTime: -1
};
const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

var corporateURL = process.env.CORPORATE_URL || "http://10.10.69.193:3031/corporateUtilityCodes";

var attributes = ["utilityCode", "chargePlan", "corporateAccount", "billingAddress", "emailId", "GSTINnumber", "createdBy", "createdDateAndTime", "updatedBy", "updatedDateAndTime"];

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
            const createdBy = req.header(userHeader);
            const ipAddress = req.header(ipHeader);
            try {
                let flag=false;
                instance.get(corporateURL).then((resp) => {
                    for(var object of resp.data) {  
                        console.log(object.achCode);
                        
                        if(object.achCode === req.body.utilityCode) {
                            flag=true;
                            break;
                        }
                    }

                    console.log("FLAG",flag);
                    
                var object = _.pick(req.body, attributes);
                debug(`Input object is: ${JSON.stringify(object)}`);
                object.createdBy = createdBy;
                object.createdDateAndTime = new Date().toISOString();
                object.updatedBy = object.createdBy;
                object.updatedDateAndTime = object.createdDateAndTime;
                corporateLinkage.save(object, ipAddress, createdBy).then((result) => {
                    response.data = result;
                    response.description = `Saved successfully`;
                    res.status(200).send(response);
                }).catch(e => {
                    debug(`Saving GL parameters promise failed: ${e}`);
                    response.status = "400";
                    response.data = e.toString();
                    response.description = "Failed to save";
                    res.status(400).send(response);
                });
            }).catch((e)=> {
                console.log(e);
                res.status(400).send(e)
            })
            } catch (error) {
                debug(`Try-catch failed: ${error}`);
                response.status = "400";
                response.data = error;
                response.description = "Failed to save";
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
                corporateLinkage.find({}, orderby, skipCount, limit, ipAddress, createdBy).then((result) => {
                    response.description = "";
                    response.data = result;
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

    router.route('/glParameter/:id')
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
                let filter = {
                    "name": object.schemeType
                };
                schemeType.find(filter, {}, 0, 1, ipAddress, createdBy)
                    .then((result) => {
                        if (_.isEmpty(result) && !_.isEmpty(object.schemeType)) {
                            throw new Error("Invalid Scheme Type.");
                        } else {
                            glParameters.update(req.params.id, object, ipAddress, createdBy).then((result) => {
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
                        }
                    }).catch(e => {
                        debug(`Finding Scheme Type promise failed: ${e}`);
                        response.status = "400";
                        response.data = e.toString();
                        response.description = "Failed to save";
                        res.status(400).send(response);
                    });
            } catch (error) {
                response.status = "400";
                response.data = error;
                response.description = "Failed to fetch Gl Parameters.";
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