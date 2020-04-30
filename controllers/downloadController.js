const { exec } = require('child_process');
var fs = require('fs');
var path = require('path');
var mongoose = require('mongoose');
var Files = mongoose.model('fileStatus');
const URL = require('url');

var defDownPath = "./Downloads/"

const downloadDir = path.join(defDownPath);

if (!fs.existsSync(downloadDir)){
    //console.log('creating missing folder '+downloadDir);
    fs.mkdirSync(downloadDir);
}

var downloadController = function(url,fileName) {
    
    getfileInfo(url,fileName);
}

var getfileInfo = function(url,fileName){

//var command = "curl -sI '"+url+"' | grep -o -E 'filename=.*$' | sed -e 's/filename=//' | sed 's/\\\"//g' | cut -d';' -f1"
//var command = "curl -sI '"+url+"'"
var command = "curl -sI '"+url+"'"

var tempurl = URL.parse(url);
console.log("Getting file information before downloading "+url);

var child = exec(command, (err, response, stderr) => {

    var contentLen = response.match(/Content-Length.*/g)[0];
    contentLen = contentLen.substring(contentLen.indexOf(':')+2,contentLen.length);
    var lastMod = response.match(/Last-Modified.*/g)[0];
    lastMod = lastMod.substring(lastMod.indexOf(':')+2,lastMod.length);
    
    var host = tempurl.host; //response.match(/Host.*/g)[0];
    var hostname = tempurl.hostname; //response.match(/Host.*/g)[0];

    var lastDate = new Date(lastMod);

    Files.findOne({'name':fileName}).exec(function (error, file){
        if(file){
            //validate, download and update if nedded
            console.log('File '+fileName+' found on database, validating dates and sizes');
            var lastDateFile = new Date(file.lastmodified);
            if(lastDateFile.getTime()<lastDate.getTime()){
                console.log('New version found for file: '+fileName);
                file.lastmodified=lastDate.getTime();
                file.contentLenght=contentLen;
                file.status='downloaded';
                getfile(url,fileName,file);
            }
            else{
                console.log('File '+fileName+' already on its latest version, nothing to do');
            }
        }
        else{
            var now = new Date();
            var file = {
                "name":fileName,
                "lastmodified": lastDate.getTime(),
                "contentLenght": contentLen,
                "hostname": hostname,
                "ip": host,
                "type": 'file',
                "status": 'downloaded' 
            };
            console.log('Downloading and Inserting new file: '+fileName);
            //console.log(file);
            
            getfile(url,fileName,file);
            //download file and insert...
        }


    });
});
}

var getfile = function(url,name,file){
var path = defDownPath+name;
var command = "curl -o "+path+" -L "+url;
var child = exec(command, (err, stderr, stdout) => {
    if (err !== null) {
        console.log('exec error: ' + err);
    }
    console.log("Downloaded file " +path);
    Files.update({ name : name }, file, { upsert : true },(err, recordsUpdated) => {
        console.log("Database updated for file " +name);
    });
});}


module.exports.downloadController = downloadController;