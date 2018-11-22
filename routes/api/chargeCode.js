var chargeCode = require("@evolvus/evolvus-charges-charge-code");
var schemeType = require("@evolvus/evolvus-charges-scheme-type");
var transactionType = require("@evolvus/evolvus-charges-transaction-type");

const _ = require("lodash");

const userHeader = "X-USER";

const ipHeader = "X-IP-HEADER";

var coreAttributes = [
  "name",
  "type",
  "amount",
  "description",
  "schemeType",
  "transactionType",
  "createdBy"
];

var filterAttributes = ["name", "type", "schemeType", "transactionType", "createdBy", "amount"];

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
  updatedDateAndTime: -1
};

module.exports = router => {
  router
    .route("/chargeCode")
    .post((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      try {
        var object = _.pick(req.body, coreAttributes);
        if (object.amount != null) {
          object.amount = object.amount.toFixed(2);
        }
        object.amount = Number(object.amount);
        object.createdBy = object.updatedBy = req.header(userHeader);
        object.updatedDateAndTime = object.createdDateAndTime = new Date().toISOString();
        var schemeTypeFilter = {
          name: object.schemeType
        };
        var transactionTypeFilter = {
          name: object.transactionType
        };
        Promise.all([
            schemeType.find(schemeTypeFilter, {}, 0, 1, req.ip, object.createdBy),
            transactionType.find(
              transactionTypeFilter, {},
              0,
              1,
              req.ip,
              object.createdBy
            )
          ])
          .then(findResponse => {
            if (_.isEmpty(findResponse[0])) {
              throw new Error("Invalid Scheme Type");
            } else if (_.isEmpty(findResponse[1])) {
              throw new Error("Invalid Transaction Type");
            } else {
              chargeCode
                .save(object, req.ip, "")
                .then(result => {
                  response.data = result;
                  response.description = `Saved ${
                    object.name
                  } Charge Code successfully`;
                  res.status(200).send(response);
                })
                .catch(e => {
                  response.status = "400";
                  response.data = e.toString();
                  response.description = "Failed to save";
                  res.status(400).send(response);
                });
            }
          })
          .catch(error => {
            response.status = "400";
            response.data = error;
            response.description = `Failed to Save : ${error.message}`;
            res.status(400).send(response);
          });
      } catch (error) {
        response.status = "400";
        response.data = error;
        response.description = "Failed to save";
        res.status(400).send(response);
      }
    })
    .get((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };

      try {
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
        var filter = _.omitBy(filterValues, function(value, key) {
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
          Promise.all([chargeCode.find(filter, orderby, skipCount, limit, ipAddress, createdBy), chargeCode.find(filter, orderby, 0, 0, ipAddress, createdBy)])
            .then(findResponse => {
              response.status = "200";
              response.data = findResponse[0];
              response.description = `Found ${findResponse[0].length} Charge Code/s`;
              response.totalNoOfPages = Math.ceil(findResponse[1].length / pageSize);
              response.totalNoOfRecords = findResponse[1].length;
              res.status(200).send(response);
            })
            .catch(error => {
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
        response.description = "Failed to Fetch Charge Codes";
        res.status(400).send(response);
      }
    });

  router.route('/chargeCode/:name')
    .put((req, res, next) => {
      var response = {
        status: "200",
        data: {},
        description: ""
      };
      try {
        var createdBy = req.header(userHeader);
        var ipAddress = req.header(ipHeader);
        var object = _.pick(req.body, coreAttributes);
        object.amount = Number(object.amount.toFixed(2));
        object.createdBy = object.updatedBy = req.header(userHeader);
        object.updatedDateAndTime = new Date().toISOString();
        chargeCode.update(req.params.name, object, ipAddress, createdBy).then((result) => {          
          response.data = result;
          response.description = `Modified ${
                                req.params.name
                              } Charge Code successfully`;
          res.status(200).send(response);
        }).catch((e) => {
          response.status = "400";
          response.data = e.toString();
          response.description = "Failed to Update";
          res.status(400).send(response);
        });
      } catch (e) {
        response.status = "400";
        response.data = error;
        response.description = "Failed to Update Charge Codes";
        res.status(400).send(response);
      }
    });
};

function sortable(sort) {
  if (typeof sort === "undefined" || sort == null) {
    return ORDER_BY;
  }
  if (typeof sort === "string") {
    var values = sort.split(",");
    var result = sort.split(",").reduce((temp, sortParam) => {
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