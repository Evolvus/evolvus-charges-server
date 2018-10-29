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
        var filterValues = _.pick(req.query, filterAttributes);
        var filter = _.omitBy(filterValues, function(value, key) {
          return value.startsWith("undefined");
        });

        var limit = _.get(req.query, "limit", LIMIT);
        var skipCount = 0;
        var sort = _.get(req.query, "sort", {});
        var orderby = sortable(sort);
        chargeCode
          .find(filter, orderby, skipCount, limit, ipAddress, createdBy)
          .then(findResponse => {
            response.status = "200";
            response.data = findResponse;
            response.description = `Found ${findResponse.length} Charge Code/s`;
            res.status(200).send(response);
          })
          .catch(error => {
            response.status = "400";
            response.data = error;
            response.description = `Failed to Fetch : ${error.message}`;
            res.status(400).send(response);
          });
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

        var object = _.pick(req.body, coreAttributes);
        object.amount = Number(object.amount.toFixed(2));
        object.createdBy = object.updatedBy = req.header(userHeader);
        object.updatedDateAndTime = new Date().toISOString();
        var schemeTypeFilter = {
          name: object.schemeType
        };
        var transactionTypeFilter = {
          name: object.transactionType
        };

        chargeCode
          .update(object, req.params.name, req.ip, "")
          .then(result => {
            response.data = result;
            response.description = `Modified ${
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


      } catch (error) {
        response.status = "400";
        response.data = error;
        response.description = "Failed to save";
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