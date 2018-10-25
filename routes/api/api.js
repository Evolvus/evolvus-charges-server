module.exports = (router) => {

  require("./schemeType")(router);
  require("./glParameters")(router);
  require("./chargeCode")(router);
  require("./transactionType")(router);
  require("./chargePlan")(router);

};