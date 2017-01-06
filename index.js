var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var caller = require('caller');


/*   public functions   */

module.exports = function getAllAnnotations(filePath, callback){
    var absolutePath = path.resolve(path.dirname(caller()), filePath);
    var fileContent = fs.readFileSync(absolutePath, {encoding: 'utf-8'});
    try {
        return {
            error: null,
            annotations: getAnnotationFromFile(absolutePath, filePath, fileContent)
        };
    } catch (e) {
        return {
            error: e,
            annotations: undefined
        };
    }
};

module.exports.sync = function(filePath){
    var absolutePath = path.resolve(path.dirname(caller()), filePath);

    var fileContent = fs.readFileSync(absolutePath, {encoding: 'utf-8'});

    return getAnnotationFromFile(absolutePath, filePath, fileContent);
};


/*   private functions   */


function getAnnotationFromFile(absolutePath, filePath, fileContent){
    var result = {
        module: {},
        functions: [],
        methods: {},
        getters: {}
    };

    var moduleToLoad = require(absolutePath);

    result.module.rawAnnotations = getRawAnnotations(fileContent, 'module');
    result.module.rawAnnotations =  _.extend(result.module.rawAnnotations, getRawAnnotations(fileContent, 'class'));

    result.module.annotations = parseAnnotations(result.module.rawAnnotations);
    result.module.ref = moduleToLoad;
    result.module.name = path.basename(filePath, path.extname(filePath));

    var obj = new moduleToLoad();
    var proto = Object.getPrototypeOf(obj);
    var names = Object.getOwnPropertyNames(proto);
    for (var i=0; i<names.length; i++) {
        var name = names[i];
        //for(var name in moduleToLoad.prototype){
        if (typeof proto[name] == "function") {
            result.methods[name] = {
                rawAnnotations: getRawAnnotations(fileContent, 'method', name),
                ref: moduleToLoad[name],
            };

            result.methods[name] = parseAnnotations(result.methods[name].rawAnnotations);
        } else if (typeof proto[name] === 'undefined') {
            // Probably a getter!
            result.getters[name] = {
                rawAnnotations: getRawAnnotations(fileContent, 'getter', name),
                ref: moduleToLoad[name],
            };

            result.getters[name] = parseAnnotations(result.getters[name].rawAnnotations);
        }
    }

    return result;
}


function getRawAnnotations(fileContent, type, name){
    suffixes = ({
        function: [name + '\\s*:\\s*function\\(', '(module\\.)?exports\\.' + name + '\\s*=\\s*'],
        getter: ['\\s*get\\s*' + name + '\\(\s*\\)\\s*{'],
        method: ['\\s*' + name + '\\([^\\)]*\\)\\s*{'],
        module: ['module\\.exports\\s*=\\s*(:?function\\([\\S\\s]*?\\))?\\s*{'],
        class: ['(?:module\\.exports\\s*=\\s*)?class\\s+[a-zA-Z_]+[a-zA-Z_0-9]*\\s+']
    })[type];
    var regex = new RegExp('((\\/\\/.*)|(\\/\\*(?:[\\s\\S](?!\\*\\/))*?\\s*\\*\\/)|\\s)*(' + suffixes.join('|') + ')');

    var matches = regex.exec(fileContent);

    if(matches === null){
        return {};
    }

    var match = matches[0];


    var annotationRegex = /@(([a-zA-Z_][a-zA-Z0-9]*)(?:\(.*\))?)/g;
    var annotationMatches;

    var result = {};


    while(annotationMatches = annotationRegex.exec(match)){

        var key = annotationMatches[2];
        var value = annotationMatches[1];

        if(key in result){
            result[key].push(value);
        }
        else{
            result[key] = [value];
        }
    }

    return result;
}

function parseAnnotations(rawAnnotations){

    var annotationRegex = /([a-zA-Z_][a-zA-Z0-9]*)(?:\((.*)\))?/;

    var result = {};

    for(var i in rawAnnotations){
        result[i] = [];
        for(var j in rawAnnotations[i]){
            var argumentsString = annotationRegex.exec(rawAnnotations[i][j])[2];
            result[i][j] = eval("(" + argumentsString + ")");
        }

        if (result[i].length == 1) {
            if (result[i][0] === undefined) {
                result[i] = true;
            } else {
                result[i] = result[i][0];
            }
        } else if (result[i].length == 0) {
            result[i] = true;
        }
    }

    return result;
}