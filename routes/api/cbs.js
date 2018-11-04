const _ = require("lodash");
const debug = require("debug")("node-schedule");
const http = require("http");
var axios = require("axios");
var accenquriyURL = process.env.ACCOUNTENQUIRY_URL || "http://10.10.69.193:6060/cdacbsservice/doGeneralAcctInquiry";
var accpostingURL = process.env.ACCOUNTPOSTING_URL || "http://192.168.1.235:6060/cdacbsservice/XferTrnAdd";
const accountverifyAttributes = ["serviceName", "reqMsgDateTime", "acctNumber"];
const accountpostingAttributes = ["serviceName", "reqMsgDateTime", "debitAccNumber", "debitAmount", "debitTxnRemarks", "creditAccNumberOne", "creditAmountOne", "creditTxnRemarksOne", "creditAccNumberTwo", "creditAmountTwo", "creditTxnRemarksTwo"];
var timeOut = process.env.TIME_OUT || 5000;
var instance = axios.create({
    baseURL: accenquriyURL,
    timeout: timeOut
});

module.exports = (router) => {

    router.route("/verifyAccount/")
        .get((req, res, next) => {
            const response = {
                status: "200",
                description: "",
                data: {}
            };
            try {
                let object = _.pick(req.query, accountverifyAttributes);
                object.reqMsgDateTime = new Date().toISOString();
                axios.post(accenquriyURL, object).then((accountres) => {
                    console.log("Account Status: " + accountres.data.statusFlg);
                    console.log("Account Number: " + accountres.data.acctNumber);
                    console.log("Account Name: " + accountres.data.acctName);
                    console.log("Account Status: " + accountres.data.acctStatus);
                    console.log("Account Type: " + accountres.data.acctType);
                    console.log("Amount Value: " + accountres.data.amountValue);
                    console.log("Account Description: " + accountres.data.errorDesc);
                    console.log("Account errorCode: " + accountres.data.errorCode);
                    response.data = accountres.data;
                    res.send(response);
                }).catch(e => {
                    response.status = "404";
                    response.description = e;
                    response.data = {};
                    res.status(404).json(response);

                });
            } catch (e) {
                var reference = shortid.generate();
                debug(`try catch promise failed due to ${e} and referenceId:${reference}`);
                response.status = "404";
                response.description = e;
                response.data = {};
                res.status(404).json(response);
            }
        });

    router.route("/accountPosting")
        .post((req, res, next) => {
            const response = {
                "status": "200",
                "description": "",
                "data": {}
            };
            try {

                res.send(response);
                // let object = _.pick(req.body, accountpostingAttributes);
                // object.reqMsgDateTime = new Date().toISOString();
                // axios.post(accpostingURL, object).then((accountpostres) => {
                //     console.log(accountpostres.data);
                //     response.data = accountpostres.data;
                //     res.send(response);
                // }).catch(e => {
                //     response.status = "400";
                //     response.description = e;
                //     response.data = {};
                //     res.status(400).json(response);

                // });
            } catch (e) {
                var reference = shortid.generate();
                debug(`try catch promise failed due to ${e} and referenceId:${reference}`);
                response.status = "400";
                response.description = ``;
                response.data = {};
                res.status(400).json(response);
            }

        });

};


