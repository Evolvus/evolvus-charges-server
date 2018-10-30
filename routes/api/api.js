module.exports = (router) => {

  require("./schemeType")(router);
  require("./glParameters")(router);
  require("./corporateLinkage")(router);
  require("./chargeCode")(router);
  require("./transactionType")(router);
  require("./chargePlan")(router);
  require("./billing")(router);

};