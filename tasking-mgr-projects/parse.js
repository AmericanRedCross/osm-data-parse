var fs = require('fs');
var path = require('path');
var flow = require('flow');
var request = require('request');
var converter = require('json-2-csv');
var turf = require('turf');
var moment = require("moment");


var timestamp = moment().format('YYYYMMDD-HHmmss');
var missingmaps = [];
// var projectList = [];
var tasksFc = { type: 'FeatureCollection', features: [] };

var throttleProjects = function(cb){
  var targetCount = 2500;
  var counter = 0;
  for (var i=0;i<targetCount;i++) {
     (function(ind) {
         setTimeout(function(){
           // # # # throttle process to limit the speed of calls to download files from the server
           fetchProjectData(ind, function(){
             counter ++;
             if(counter === targetCount){ cb(); }
           })
         }, 500 + (100 * ind));
     })(i);
  }
}

var fetchProjectData = function(projectNumber, cb) {
  request({
    method: 'GET',
    uri: "http://tasks.hotosm.org/api/v1/project/" + projectNumber + ".json"
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var jsonResponse = JSON.parse(body);
      if(jsonResponse.properties){
        /// capitalization or presence/lack of a space in Missing Maps shouldn't matter
        var nameCheck = jsonResponse.properties.name.replace(/\s+/g, '').toLowerCase().indexOf("missingmaps");
        if(nameCheck !== -1){
          // projectList.push(projectNumber); // # # # compile list of project numbers to next fetch detailed task data
          var projectObj = {
            "task_number": projectNumber,
            "created" : jsonResponse.properties["created"].slice(0,10),
            "name": jsonResponse.properties["name"].replace(/"/g,""),
            "changeset_comment":jsonResponse.properties["changeset_comment"],
            "author": jsonResponse.properties["author"],
            "status":jsonResponse.properties["status"],
            "done": jsonResponse.properties["done"],
            "validated": jsonResponse.properties["validated"]
          }
          missingmaps.push(projectObj);
          console.log("missingmaps :  " + projectNumber);
        } else { console.log("other task  :  " + projectNumber); }
      }
      cb();
    } else {
      console.log("failed     :  " + projectNumber)
      console.log("error      :  " + error )
      cb();
    }
  });
}

var throttleTasks = function(cb){
  var targetCount = 0;
  var counter = 0;
  targetCount = missingmaps.length;
  for (var i=0;i<targetCount;i++) {
     (function(ind) {
         setTimeout(function(){
           // # # # throttle process to limit the speed of calls to download files from the server
           fetchTaskData(ind, function(){
             counter ++;
             if(counter === targetCount){ cb(); }
           });
         }, 500 + (100 * ind));
     })(i);
  }
}

var fetchTaskData = function(prjIndex, cb) {
  var thisPrj = missingmaps[prjIndex];
  console.log("http://tasks.hotosm.org/api/v1/project/" + thisPrj["task_number"] + "/tasks.json")
  request({
    method: 'GET',
    uri: "http://tasks.hotosm.org/api/v1/project/" + thisPrj["task_number"] + "/tasks.json"
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var jsonResponse = JSON.parse(body);
      for(var i=0; i<jsonResponse.features.length; i++){
        var tile = jsonResponse.features[i];
        var thisState = tile.properties.state;
        // 2 is done and 3 is validated
        // https://github.com/hotosm/osm-tasking-manager2/wiki/API#list-of-tasks-with-state-and-lock-status
        if(taskStatus === Mapped || taskStatus === Validated) {
          var tileProp = {
            "task": thisPrj["task_number"],
            "created": thisPrj["created"],
            "state": taskStatus
          };
          tasksFc.features.push(turf.feature(tile.geometry, tileProp));
        }

      }
      console.log("processed tasks for #" + thisPrj["task_number"]);
      cb();
    } else {
      console.log("failed getting tasks json for #" + thisPrj["task_number"])
      console.log("error      :  " + error )
      cb();
    }
  });
}

var parseTasks = flow.define(
  function(){
    throttleTasks(this);
  },
  function(){
    var filePath = path.join(__dirname,"output", "output_" + timestamp + ".geojson");
    fs.writeFile(filePath, JSON.stringify(tasksFc));
  }
);

var parseProjects = flow.define(
  function(){
    throttleProjects(this);
  },
  function(){
    var options = {
      delimiter : {
       wrap  : '"', // Double Quote (") character
   }
    }
    converter.json2csv(missingmaps, function(err, csv){
      var filePath = path.join(__dirname,"output", "output_" + timestamp + ".csv");
      fs.writeFile(filePath, csv);
      parseTasks();
    }, options);
  }
);

parseProjects();
