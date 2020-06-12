'use strict';
var fs = require('fs');
var path = require('path');
var mongoose = require('mongoose');
var fileStatus = mongoose.model('fileStatus');
var AdmZip = require('adm-zip');
var executCommand = require('./shellController').executeCommand;
//var extract = require('extract-zip');

var runCommand = async function(command,params){
    try {  return await executCommand(command,params);
    } catch(err) { console.log(err) }
}

var extraxtPath = "./extractedData"
var xslxToMongo = require('./xslxToMongo').xslxToMongo;


const directoryPath = path.join(__dirname, '../Downloads');
const extPath = path.join(__dirname, '../extractedData');

if (!fs.existsSync(extraxtPath)){
    //console.log('creating missing folder '+extraxtPath);
    fs.mkdirSync(extraxtPath);
};

var processSSAFiles = function(){
    getFiles();
}

var getFiles = function(){

    //passsing directoryPath and callback function
    fs.readdir(directoryPath, function (err, files) {
        //handling error
        if (err) {
            return console.log('Unable to scan directory: ' + err);
        } 
        //listing all files using forEach
        files.forEach(function (fileName) {
            //console.log(fileName);

            fileStatus.findOne({'name':fileName}).exec( async function (error, file){
                if(file){

                    if(file.status=='downloaded'){

                        console.log('Extracting file '+fileName);
                        var zip = new AdmZip(path.join(__dirname, '../Downloads/')+fileName);
                        var zipEntries = zip.getEntries();

                        zip.extractAllToAsync(extPath,true, function(err){
                            if(err)
                                console.log(err);

                                //console.log(ext);
                                console.log('Extracted file '+fileName);                                
                                switch(fileName){
                                    case 'diccionario_datos_covid19.zip':
                                        //backup data and droip tables...
                                        processDictionary(zipEntries, fileName);
                                        break;
                                    case 'datos_abiertos_covid19.zip':
                                        //backup data and droip tables...here too??? or only backup...
                                        processBigData(zipEntries, fileName, file);
                                        break;
                                }
                        });
                        

                    }
                    else{
                        console.log('File already processed '+fileName);
                    }
                    //eslse file already processed
                }
                else{
                    console.log('File not found on DataBase, please Check '+fileName);
                }
            });
            
        });
    });
}

var deleteCatalogues = async function(){

}

var processDictionary = function(files, file){
    //mongooDB stuff add new caltalogues...
    
    console.log('Processing Catalogue Data form File');
    files.forEach(function (fileName) {
        if(fileName.entryName.includes('Catalogos')){
            var index = [{tbl:'Catalogo_RESULTADO',index:'CLAVE'}];
            var filePath = path.join(extPath, fileName.entryName);
            var options = { url: 'mongodb://localhost', db: 'covid19Fetch', workbook: filePath, fileName: fileName.name, index:index, rotate: false}
            xslxToMongo(options, function(result){
                fileStatus.findOne({'name':file}).exec(function (error, dbFile){
                    dbFile.status = 'processed';
                    dbFile.save(function(){
                            console.log('Catalogue Data Updated');
                        }
                    );
                });
            });
        }
    });
}

var processData = function(files, file){
    console.log('Processing Data form Files: '+files);
    files.forEach(function (fileName) {
        var filePath = path.join(extPath, fileName.entryName);
        //add indexes
        var options = { url: 'mongodb://localhost', db: 'covid19Fetch', workbook: filePath, fileName: fileName.name, rotate: true}
        console.log('calling xslxToMongo')
        xslxToMongo(options, function(result){
                fileStatus.findOne({'name':file}).exec(function (error, dbFile){
                    dbFile.status = 'processed';
                    dbFile.save(function(){
                            console.log('Data Collection Updated');
                        }
                    );
                });
            });
    });
}




var processBigData = function(files, file){
    console.log('Processing Big Data form Files: '+files);
    files.forEach(async function (fileName) {
        
        var filePath = path.join(extPath, fileName.entryName);
        //add indexes
        var options = { url: 'mongodb://localhost', db: 'covid19Fetch', workbook: filePath, fileName: fileName.name, rotate: true}
        var prog = 'sh';
        var params = ['scripts/rollOutCollections.sh', extPath, options.fileName, options.db, options.rotate];
        var data = await runCommand(prog,params);
        console.log(data);
        fileStatus.findOne({'name':file}).exec(function (error, dbFile){
            dbFile.status = 'processed';
            dbFile.save(function(){
                    console.log('Data Collection Updated');
                }
            );
        });
    });
}

module.exports.processSSAFiles = processSSAFiles;

