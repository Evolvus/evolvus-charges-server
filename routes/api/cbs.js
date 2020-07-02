const _ = require("lodash");
const debug = require("debug")("node-schedule");
const http = require("http");
var axios = require("axios");
var accenquiryURL = process.env.ACCOUNTENQUIRY_URL || "http://10.10.69.193:3037/cdacbsservice/dogeneralaccinquiry";
var accpostingURL = process.env.ACCOUNTPOSTING_URL || "http://10.10.69.193:3037/cdacbsservice/xfertrnadd";
const accountverifyAttributes = ["serviceName", "reqMsgDateTime", "acctNumber"];
const accountpostingAttributes = ["serviceName", "reqMsgDateTime", "debitAccNumber", "debitAmount", "debitTxnRemarks", "creditAccNumberOne", "creditAmountOne", "creditTxnRemarksOne", "creditAccNumberTwo", "creditAmountTwo", "creditTxnRemarksTwo"];
var timeOut = process.env.TIME_OUT || 5000;
var instance = axios.create({
    baseURL: accenquiryURL,
    timeout: timeOut
});
const billing = require("@evolvus/evolvus-charges-billing");
var glParameters = require("@evolvus/evolvus-charges-gl-parameters");
var corporate = require("@evolvus/evolvus-charges-corporate-linkage");

const userHeader = "X-USER";
const ipHeader = "X-IP-HEADER";

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
                object.serviceName = "doGeneralAcctInquiry";
                object.reqMsgDateTime = new Date().toISOString();
                axios.post(accenquiryURL, object).then((accountres) => {                    
                    debug("Account Status: " + accountres.data.statusFlg);
                    debug("Account Number: " + accountres.data.acctNumber);
                    debug("Account Name: " + accountres.data.acctName);
                    debug("Account Status: " + accountres.data.acctStatus);
                    debug("Account Type: " + accountres.data.acctType);
                    debug("Amount Value: " + accountres.data.amountValue);
                    debug("Account Description: " + accountres.data.errorDesc);
                    debug("Account errorCode: " + accountres.data.errorCode);
                    response.data = accountres.data;
                    debug(response.data);
                    res.json(response);
                }).catch(e => {                    
                    response.status = "404";
                    response.description = "Account Verification Failed";
                    response.data = e.toString();
                    res.status(404).json(response);
                });
            } catch (e) {                
                var reference = shortid.generate();
                debug(`try catch promise failed due to ${e} and referenceId:${reference}`);
                response.status = "404";
                response.description = "Account Verification Failed";
                response.data = e.toString();
                res.status(404).json(response);
            }
        });

    router.route("/accountPosting/")
        .post((req, res, next) => {            
            const response = {
                "status": "200",
                "description": "",
                "data": {}
            };            
            try {
                const createdBy = req.header(userHeader);
                const ipAddress = req.header(ipHeader);
                let details = {};
                let filter = {
                    "billNumber": req.body.billNumber
                }
                billing.find(filter, {}, 0, 0, ipAddress, createdBy).then((billObject) => {                    
                    if (billObject.length > 0) {
                        Promise.all([glParameters.find({}, {}, 0, 0, ipAddress, createdBy), corporate.find({ "utilityCode": billObject[0].utilityCode }, {}, 0, 0, ipAddress, createdBy)])
                            .then(result => {                                                                
                                if (result[0].length > 0 && result[1].length > 0) {
                                    details.serviceName = "XferTrnAdd";
                                    details.reqMsgDateTime = new Date().toISOString();
                                    details.debitAccNumber = result[1][0].corporateAccount;
                                    var countONUS = 0,countOFFUS = 0;
                                    billObject[0].details.forEach(element  => {
                                     if(element.name.includes('ONUS')&& element.transactions > 0){
                                         countONUS = countONUS + 1
                                    }
                                    else if(!element.name.includes('ONUS')&& element.transactions > 0){
                                            countOFFUS = countOFFUS + 1   
                                    }
                                    else{
                                        debug("No transactions for", element.name);
                                    }
                                    });
                                    if(countONUS > 0 && countOFFUS > 0)
                                    {
                                        details.debitTxnRemarks = `ONUS/OFFUS/CHRG/${billObject[0].utilityCode}/${billObject[0].billPeriod}`  
                                    }
                                    else if(countOFFUS > 0){
                                        details.debitTxnRemarks = `NACH/CHRG/${billObject[0].utilityCode}/${billObject[0].billPeriod}`
                                    }
                                    else{
                                        details.debitTxnRemarks = `DDI/CHRG/${billObject[0].utilityCode}/${billObject[0].billPeriod}`
                                    }
                                    details.debitAmount = billObject[0].finalTotalAmount;
                                    details.creditAccNumberOne = result[0][0].chargesAccount;
                                    details.creditAmountOne = billObject[0].finalChargesAmount;
                                    details.creditTxnRemarksOne = `${billObject[0].utilityCode}/${result[1][0].corporateAccount}/${billObject[0].billPeriod}`;
                                    details.creditAccNumberTwo = result[0][0].GSTAccount;
                                    details.creditAmountTwo = billObject[0].finalGSTAmount;
                                    details.creditTxnRemarksTwo = `${billObject[0].utilityCode}/${result[1][0].GSTINnumber}/${billObject[0].billPeriod}`;                                    
                                    let object = _.pick(details, accountpostingAttributes);
                                    object.reqMsgDateTime = new Date().toISOString();
                                    axios.post(accpostingURL, object).then((accountpostres) => {                                                                                  
                                        if(accountpostres.data != null && accountpostres.data.statusFlg != "0" && accountpostres.data.errorCode != null && accountpostres.data.errorCode != "NA") {
                                            let str = accountpostres.data.errorCode.split("\n");
                                            debug("Error Code is ",str[0])
                                            accountpostres.data.errorCode = str[0];
                                        }
                                        debug(accountpostres.data);
                                        response.data = accountpostres.data;
                                        res.json(response);
                                    }).catch(e => {                                        
                                        response.status = "400";
                                        response.description = "Failed at Account Posting";
                                        response.data = e.toString();
                                        res.status(400).json(response);

                                    });
                                } else {
                                    throw new Error("Failed to get Corporate or GL Account Details.")
                                }
                            }).catch(e => {                                
                                response.status = "400";
                                response.description = e;
                                response.data = {};
                                res.status(400).json(response);
                            })
                    } else {
                        throw new Error(`Bill ${req.body.billNumber} not found.`);
                    }
                }).catch(e => { 
                    debug("error:",e)                                       
                    response.status = "400";
                    response.description = e;
                    response.data = {};
                    res.status(400).json(response);
                });

            } catch (e) {                                
                var reference = shortid.generate();
                debug(`try catch promise failed due to ${e} and referenceId:${reference}`);
                response.status = "400";
                response.description = "Failed at Account Posting";
                response.data = e.toString();
                res.status(400).json(response);
            }

        });

};


