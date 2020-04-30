let MongoClient = require('mongodb').MongoClient;
let xlsx = require('xlsx');

var xslxToMongo = function(options, callback){
    //call backup an from there createConversion
    createCoversion(options, callback);
}

function createCoversion(options, callback){

    const workbook = xlsx.readFile(options.workbook);
    let sheet_name_list = workbook.SheetNames;

    (async () => {
        let client = await MongoClient.connect(options.url,{ useUnifiedTopology: true, useNewUrlParser: true });

        let db = client.db(options.db);

        try {
            //rotate tables...
            for (let i = 0; i < sheet_name_list.length; i++) {
                
                let records = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[i]]);
                if (records.length) {
                    console.log(records[0])
                    var name = sheet_name_list[i].replace(/\s/g, '_').replace(/[àáâãäå]/g,"a");
                    console.log('Inserting '+records.length+ ' records to Collection '+name);
                    const bckup = await backup(options,name);
                    const resCreate = await db.createCollection(name);
                    const resInsert = await db.collection(name).insertMany(records);
                    console.log('Inserted '+records.length+ ' records to Collection '+name);
                }
            }
        }
        finally {
            client.close();
            callback(true);
        }
    })().catch(err => console.error(err));
}

var createIndex = async function (options, index){
    
}


var backup = async function (options, name){
    var d = new Date();
    d.setDate(d.getDate()-1);
    
    let client = await MongoClient.connect(options.url,{ useUnifiedTopology: true, useNewUrlParser: true });
    let db = client.db(options.db);
    try {
        var newName = name+d.toISOString().split('T')[0].replace(/-/g,'')
        console.log('Rotating Collection '+name);
        const resInsert = await db.collection(name).rename(newName);
    }
    finally {
        client.close();
        return true;
    }
}

module.exports.xslxToMongo = xslxToMongo;