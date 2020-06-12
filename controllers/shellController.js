const { execFileSync } = require('child_process');

var executeCommand = function (command, params){
    var result = execFileSync(command, params, []);
    return result.toString();
};

module.exports.executeCommand = executeCommand;