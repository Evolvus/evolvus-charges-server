# evolvus-charges-server

## To build the image
```
sudo docker build -t hobbs.evolvus.com:11083/evolvus-charges-server .
```

## To deploy the image to nexus
```
docker image push hobbs.evolvus.com:11083/evolvus-charges-server:latest

```

## To start the service
```
export TZ=Asia/Kolkata
export MONGO_DB_URL=mongodb://UserAdmin:12356789@10.24.62.134:27017/testdb?poolSize=100&authSource=admin
export DEBUG=evolvus*
export CHARGES_SERVICE_URL=http://10.24.62.135:9292/api
export CDA_URL=http://10.24.62.135:3031/chargesTxnDetails
export ACCOUNTENQUIRY_URL=http://10.24.62.135:3037/cdacbsservice/dogeneralaccinquiry
export ACCOUNTPOSTING_URL=http://10.24.62.135:3037/cdacbsservice/xfertrnadd
export CORPORATE_URL=http://10.24.62.135:3031/corporateUtilityCodes
export DOCKET_POST_URL=http://10.24.62.135:8085/api/audit
export SWE_URL=http://10.24.62.135:8088/api/swe
export SCHEDULE_PERIOD_BILL=1 1 18 * * *
export SCHEDULE_PERIOD_REATTEMPT=1 1 * * * *
export PDF_STORAGE_PATH=/backup/cdanach/cda_home/application-property-files/pdf/
export XML_STORAGE_PATH=/backup/cdanach/cda_home/application-property-files/xml/
export STATIC_FILES_PATH=/backup/cdanach/cda_home/application-property-files/static/
export REATTEMPT_IN_DAYS=3
export ERROR_CODE=W0205
export LOGO_PATH=/backup/cdanach/cda_home/application-property-files/static/logo.jpg

docker run -d --rm --name evolvus-charges-server -e TZ -e MONGO_DB_URL -e DEBUG -e CHARGES_SERVICE -e CDA_URL -e ACCOUNTENQUIRY_URL -e ACCOUNTPOSTING_URL -e CORPORATE_URL -e DOCKET_POST_URL -e SWE_URL -e SCHEDULE_PERIOD_BILL -e SCHEDULE_PERIOD_REATTEMPT -e PDF_STORAGE_PATH -e XML_STORAGE_PATH -e STATIC_FILES_PATH -e REATTEMPT_IN_DAYS -e ERROR_CODE -e LOGO_PATH -v /backup/cdanach/cda_home/application-property-files/static/:/backup/cdanach/cda_home/application-property-files/static/ -v /backup/cdanach/cda_home/application-property-files/pdf/:/backup/cdanach/cda_home/application-property-files/pdf/ -v /backup/cdanach/cda_home/application-property-files/xml/:/backup/cdanach/cda_home/application-property-files/xml/ -p 9292:9292 182.72.155.166:10515/evolvus-charges-server:latest
```
