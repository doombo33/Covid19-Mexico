let MongoClient = require('mongodb').MongoClient;
let xlsx = require('xlsx');

var indxFields = [];

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
                    //console.log(records[0])
                    var name = sheet_name_list[i].replace(/\s/g, '_').replace(/[àáâãäå]/g,"a");
                    const bckup = await backup(options,name);
                    console.log('Inserting '+records.length+ ' records to Collection '+name);
                    const resCreate = await db.createCollection(name);
                    //create index
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
    //lets check this out maybe has to be 2 days intead of 1
    d.setDate(d.getDate()-2);

    let client = await MongoClient.connect(options.url,{ useUnifiedTopology: true, useNewUrlParser: true });
    let db = client.db(options.db);
    try {
        if(options.rotate){
            var newName = name+'_'+d.toISOString().split('T')[0].replace(/-/g,'')
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

module.exports.xslxToMongo = xslxToMongo; 