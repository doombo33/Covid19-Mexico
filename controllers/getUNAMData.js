var mongoose = require('mongoose');
var Files = mongoose.model('fileStatus');
const URL = require('url');
const request = require('request');
var https = require('https');
var ip = require("ip");
var Schema = mongoose.Schema;
var maxRecordCount = 0;

var getUNAMData = function(){
    getDataInfo();
}

var convertUTCDateToLocalDate = function(date) {
    var newDate = new Date(date.getTime() - date.getTimezoneOffset()*60*1000);
    return newDate;
}

var getDataInfo = function(params) {
    var url = 'https://services8.arcgis.com/7rTEsmPVkVyyRlIk/arcgis/rest/services/mundb2020/FeatureServer/0?f=pjson'
    var fileName = 'UnamData';

    var urls = [];
    //add column list
    var requestAsync = function(url) {
        return new Promise((resolve, reject) => {
            var reqs = request(url, (err, response, body) => {
                if (err) return reject(err, response, body);
                resolve(JSON.parse(body));
            });
        });
    };
    
    var getParallel = async function(callBack) {
        try {
            var data = await Promise.all(urls.map(requestAsync));
        } catch (err) {
            console.error(err);
        }
        callBack(data);
    }

    var callBack = function(response) {
        var data = response[0];
        var lastDate = new Date(data.editingInfo.lastEditDate);
        console.log(lastDate.toLocaleString());
        var myDate = convertUTCDateToLocalDate(lastDate); //new Date(lastDate.toLocaleString());
        maxRecordCount = data.maxRecordCount;
        
        Files.findOne({'name':fileName}).exec(function (error, file){
            if(file){
                console.log('File '+fileName+' found on database, validating dates and sizes');
                var lastDateFile = new Date(file.lastmodified);

                if(lastDateFile.getTime()<lastDate.getTime()){
                    console.log('New version found for file: '+fileName);
                    file.lastmodified=lastDate.getTime();
                    file.contentLenght=contentLen;
                    file.status='downloading';
                    getData(file);
                }
                else{
                    console.log('File '+fileName+' already on its latest version, nothing to do');
                }
            }
            else{
                var now = new Date();
                var hostname = 'services8.arcgis.com'
                var host = '209.222.18.222';
                var contentLen = 0;
                var file = {
                    "name":fileName,
                    "lastmodified": lastDate.getTime(),
                    "contentLenght": contentLen,
                    "hostname": hostname,
                    "ip": host,
                    "type": 'json',
                    "status": 'downloading' 
                };
                console.log('Downloading and Inserting new file: '+fileName);
                console.log(file);
                //download file and insert...

                getData(file);
            }
        });
        
    };
    urls.push(url);
    getParallel(callBack);
}

var getData = function(file) {
    var urls = [];
    //add column list
    var requestAsync = function(url) {
        return new Promise((resolve, reject) => {
            var reqs = request(url, (err, response, body) => {
                
                if (err) return reject(err, response, body);
                resolve(JSON.parse(body));
            });
        });
    };
    
    var getParallel = async function(callBack) {
        try {
            var data = await Promise.all(urls.map(requestAsync));
        } catch (err) {
            console.error(err);
        }
        callBack(data);
    }

    var callBack = function(response) {
        var d = new Date(file.lastmodified);
        d = convertUTCDateToLocalDate(d);
        var tblName = file.name+d.toISOString().split('T')[0].replace(/-/g,'');
        //console.log(tblName);
        var allData = new Array();
        var allFields = new Array();
        var oneTime = true;
        var schema = {};
        for(i=0;i<response.length;i++){

            var obj = response[i];
            var data = obj.features;
            //TODO checkit out
            if(oneTime){
                var fields = obj.fields;
                
                for(k=0;k<fields.length;k++){
                    var field = fields[k];
                    schema[field.name]=field.type=='esriFieldTypeDouble'?'Number':'String'
                }
                oneTime = false;
            }
            for(j=0;j<data.length;j++){
                innerObj = data[j].attributes;
                allData.push(innerObj);
            }
        }
        console.log(schema);
        var tblSchema = new Schema(schema);
        var model = mongoose.model(tblName, tblSchema);
        model.insertMany(allData,function(err, docs){
            console.log(docs.length);
            file.status='processed';
            Files.update({ name : file.name }, file, { upsert : true },(err, recordsUpdated) => {
                console.log("Database updated for file " +file.name);
            });
        });
    }



    var numRecords = maxRecordCount;
    var maxRecords = 2465;
    var start = 0;
    var number = maxRecords;
    var array = [];
    while (number > 0) {
        array.push(Math.min(number, numRecords));
        number = number - numRecords;
    }

    for(i=0;i<array.length;i++) {
        var option = 'https://services8.arcgis.com/7rTEsmPVkVyyRlIk/arcgis/rest/services/mundb2020/FeatureServer/0/query?where=1%3D1&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&resultType=none&distance=0.0&units=esriSRUnit_Meter&returnGeodetic=false&outFields=*&returnGeometry=false&returnCentroid=false&featureEncoding=esriDefault&multipatchOption=xyFootprint&maxAllowableOffset=&geometryPrecision=&outSR=&datumTransformation=&applyVCSProjection=false&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnExtentOnly=false&returnQueryGeometry=false&returnDistinctValues=false&cacheHint=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&having=&resultOffset='+start+'&resultRecordCount='+numRecords+'&returnZ=false&returnM=false&returnExceededLimitFeatures=true&quantizationParameters=&sqlFormat=none&f=pjson&token=';
        urls.push(option);
        start+=numRecords;
    }
    //console.log(urls);
    getParallel(callBack);
}


module.exports.getUNAMData = getUNAMData;