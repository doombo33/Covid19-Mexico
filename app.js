require('./database');

var cron = require("node-cron");
var express = require('express');
var downloadController = require('./controllers/downloadController').downloadController;
var processSSAFiles = require('./controllers/processSSAFiles').processSSAFiles;
var getUNAMData = require('./controllers/getUNAMData').getUNAMData;

var index = require('./routes/index');

var app = express();

app.use(function(req, res, next) {
    //CORS
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


app.set('port', process.env.PORT || 8030);

//Mexico SSA File Download
cron.schedule("0 20,21,22 * * *", function() {
    //validate the other file
    var url = 'http://187.191.75.115/gobmx/salud/datos_abiertos/${uri}';
    var d = new Date();
    console.log("checking SSA covid19 files and download if needed every 30 minutes");
    var DT_W_URL = url;

    var uri = ['diccionario_datos_covid19.zip','datos_abiertos_covid19.zip'];
    console.log('Starting file validation and download');
    for(i=0;i<uri.length;i++) {
        downloadController(DT_W_URL.replace('${uri}',uri[i]),uri[i]);
    }
});

//SSA File processing
cron.schedule("5 20,21,22 * * *", function() {
    //validate the other file
    var d = new Date();
    console.log("processing SSA covid19 files if needed every 35 minutes");
    console.log('Starting file processing');
    processSSAFiles();
});

//So i need to add the options rotate for the evolucion_nacX table, so it is always done with the last one, same name and dropping the others...
//Unam GeoData download and processing
cron.schedule("15 12,20,21,22 * * *", function() {

    var fileNames = ['mundb2020','evolucion_nac4'];
    var numRecords = [2465,500];
    var url = 'https://services8.arcgis.com/7rTEsmPVkVyyRlIk/arcgis/rest/services/${uri}/FeatureServer/0?f=pjson'
    var d = new Date();
    console.log("processing UNAM GeoData covid19 files if needed every 40 minutes");
    console.log('Starting file processing');
    for(i=0;i<fileNames.length;i++) {
        //can send the options fomr here...
        getUNAMData(url.replace('${uri}',fileNames[i]),fileNames[i],numRecords[i]);
    }
});


var server = app.listen(8030, function () {
    host = server.address().address;
    port = server.address().port;
    console.log('Covid19-Fetch app listening at http://%s:%s', host, port);
});