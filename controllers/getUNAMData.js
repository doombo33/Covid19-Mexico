let MongoClient = require('mongodb').MongoClient;
const request = require('request');
var maxRecordCount = 0;
var dbFiles = 'filestatuses';
var index = [{tbl:'Catalogo_RESULTADO',index:'CLAVE'}];
var options = { url: 'mongodb://localhost', db: 'covid19Fetch', index:index, rotate: true};

var getUNAMData = function(url, fileName, amnt){
    getDataInfo(url, fileName, amnt);
}

var convertUTCDateToLocalDate = function(date) {
    var newDate = new Date(date.getTime() - date.getTimezoneOffset()*60*1000);
    return newDate;
}

var getDataInfo = function(url, fileName, amnt) {
    
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
        //console.log(lastDate.toLocaleString());
        var myDate = convertUTCDateToLocalDate(lastDate); //new Date(lastDate.toLocaleString());
        maxRecordCount = data.maxRecordCount;
        
        //
        (async () => {
            let client = await MongoClient.connect(options.url,{ useUnifiedTopology: true, useNewUrlParser: true });
            let db = client.db(options.db);
            try {
                var file = await db.collection(dbFiles).find({'name':fileName}).toArray();
                file = file[0];
                if(file){
                    
                    console.log('File '+fileName+' found on database, validating dates and sizes');
                    var lastDateFile = new Date(file.lastmodified);
    
                    if(lastDateFile.getTime()<lastDate.getTime()){
                        console.log('New version found for file: '+fileName);
                        file.lastmodified=lastDate.getTime();
                        file.contentLenght=contentLen;
                        file.maxRecords=amnt,
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
                        "status": 'downloading',
                        "maxRecords": amnt
                    };
                    console.log('Downloading and Inserting new file: '+fileName);
                    console.log(file);
                    //download file and insert...
    
                    getData(file);
                }

            }
            finally {
                client.close();
            }
        })().catch(err => console.error(err));
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


    var backup = async function (options, name){
        var d = new Date();
        //lets check this out maybe has to be 2 days intead of 1
        d.setDate(d.getDate()-1);
    
        let client = await MongoClient.connect(options.url,{ useUnifiedTopology: true, useNewUrlParser: true });
        let db = client.db(options.db);
        try {
            if(options.rotate){
                var d = new Date();
                d.setDate(d.getDate()-1);

                var dString = d.getFullYear()+''+('0' + (d.getMonth()+1)).slice(-2)+''+('0' + d.getDate()).slice(-2);
                var newName = name+'_'+dString;
                console.log('Rotating Collection '+name);
                const resRename = await db.collection(name).rename(newName);
            }
            else{
                console.log('Droppping Collection '+name);
                const resDrop = await db.collection(name).drop();
            }
        }
        finally {
            client.close();
            return true;
        }
    }


    var callBack = async function(response) {

        var d = new Date();
        d.setDate(d.getDate()-1);

        var dString = d.getFullYear()+''+('0' + (d.getMonth()+1)).slice(-2)+''+('0' + d.getDate()).slice(-2);
        //console.log('callback '+dString);
        var tblName = file.name+'_'+ dString; //d.toISOString().split('T')[0].replace(/-/g,'');
        var allData = new Array();

        var oneTime = true;
        var schema = {};
        for(i=0;i<response.length;i++){

            var obj = response[i];
            var data = obj.features;
            
            //TODO checkit out not needed any more :(
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

        let client = await MongoClient.connect(options.url,{ useUnifiedTopology: true, useNewUrlParser: true });

        let db = client.db(options.db);

        try {
            //rotate tables...
            var name = file.name;
            const bckup = await backup(options,name);
            console.log('Inserting '+allData.length+ ' records to Collection '+name);
            const resCreate = await db.createCollection(name);
            //create index
            const resInsert = await db.collection(name).insertMany(allData);
            console.log('Inserted '+allData.length+ ' records to Collection '+name);
            //db.colletion.updateOne...
            db.collection(dbFiles).update({ name : file.name }, file, { upsert : true },(err, recordsUpdated) => {
              console.log("Database updated for file " +file.name);
            });
        }
        finally {
            client.close();
        }
    }

    //add error validation
    var numRecords = maxRecordCount;
    var maxRecords = file.maxRecords;
    var start = 0;
    var number = maxRecords;
    var array = [];
    while (number > 0) {
        array.push(Math.min(number, numRecords));
        number = number - numRecords;
    }

    for(i=0;i<array.length;i++) {
        var option = 'https://services8.arcgis.com/7rTEsmPVkVyyRlIk/arcgis/rest/services/'+file.name+'/FeatureServer/0/query?where=1%3D1&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&resultType=none&distance=0.0&units=esriSRUnit_Meter&returnGeodetic=false&outFields=*&returnGeometry=false&returnCentroid=false&featureEncoding=esriDefault&multipatchOption=xyFootprint&maxAllowableOffset=&geometryPrecision=&outSR=&datumTransformation=&applyVCSProjection=false&returnIdsOnly=false&returnUniqueIdsOnly=false&returnCountOnly=false&returnExtentOnly=false&returnQueryGeometry=false&returnDistinctValues=false&cacheHint=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&having=&resultOffset='+start+'&resultRecordCount='+numRecords+'&returnZ=false&returnM=false&returnExceededLimitFeatures=true&quantizationParameters=&sqlFormat=none&f=pjson&token=';
        urls.push(option);
        start+=numRecords;
    }
    //console.log(urls);
    getParallel(callBack);
}

module.exports.getUNAMData = getUNAMData;