var transactionType = require("@evolvus/evolvus-charges-transaction-type");
const _ = require("lodash");

var attributes = [
  "name",
  "code",
  "type",
  "schemeType",
  "createdBy",
  "createdDateAndTime",
  "updatedBy",
  "updatedDateAndTime"
];

const LIMIT = process.env.LIMIT || 20;
const PAGE_SIZE = 20;
const ORDER_BY = process.env.ORDER_BY || {
  updatedDateAndTime: -1
};

const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

module.exports = router => {
  router
    .route("/transactionType")
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
        object.createdBy = createdBy;
        object.createdDateAndTime = new Date().toISOString();
        object.updatedBy = object.createdBy;
        object.updatedDateAndTime = object.createdDateAndTime;
        transactionType
          .save(object, ipAddress, createdBy)
          .then(result => {
            response.data = result;
            response.description = "Saved successfully";
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
    })
    .get((req, res, next) => {
      var response = {
        status: "200",
        description: "",
        data: []
      };

      try {
        var limit = _.get(req.query, "limit", LIMIT);
        var skipCount = 0;
        var sort = _.get(req.query, "sort", {});
        var orderby = sortable(sort);
        var filter = req.query;
        transactionType
          .find(filter, orderby, skipCount, limit, req.ip, "")
          .then(result => {
            (response.description = `Found ${result.length} Transaction Types`),
              (response.data = result);
            res.status(200).send(response);
          });
      } catch (error) {
        response.status = "400";
        response.data = error.toString();
        response.description = "Failed to fetch Transaction Types";
        res.status(400).send(response);
      }
    });
};

function sortable(sort) {
  if (typeof sort === undefined ||
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

