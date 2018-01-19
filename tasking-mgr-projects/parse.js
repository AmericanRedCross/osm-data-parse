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

var startProject = 700;
var maxProject = 704;

var throttleProjects = function(cb){
  var targetCount = maxProject - startProject;
  var counter = 0;
  for (var i=startProject;i<maxProject+1;i++) {
     (function(ind) {
        // # # # delay in milliseconds, should result in ~2 second spacing between calls
        var timeoutTime = (2000 * (ind - startProject)); 
         setTimeout(function(){
           // # # # throttle process to limit the speed of calls to download files from the server
           fetchProjectData(ind, function(){
             counter ++;
             if(counter === targetCount){ cb(); }
           })
         }, timeoutTime);
     })(i);
  }
}

var fetchProjectData = function(projectNumber, cb) {
  request({
    method: 'GET',
    uri: "http://tasks.hotosm.org/api/v1/project/" + projectNumber + "/summary"
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var jsonResponse = JSON.parse(body);
      if(jsonResponse){
        /// capitalization or presence/lack of a space in Missing Maps shouldn't matter
        var nameCheck = jsonResponse.name.replace(/\s+/g, '').toLowerCase().indexOf("missingmaps");
        if(nameCheck !== -1){
          // projectList.push(projectNumber); // # # # compile list of project numbers to next fetch detailed task data
          var projectObj = {
            "task_number": projectNumber,
            "created" : jsonResponse["created"].slice(0,10),
            "name": jsonResponse["name"].replace(/"/g,""),
            "author": jsonResponse["organisationTag"],
            "status":jsonResponse["status"],
            "done": jsonResponse["percentMapped"],
            "validated": jsonResponse["percentValidated"]
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
  console.log("https://tasks.hotosm.org/api/v1/project/" + thisPrj["task_number"])
  request({
    method: 'GET',
    uri: "https://tasks.hotosm.org/api/v1/project/" + thisPrj["task_number"]
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var jsonResponse = JSON.parse(body);
      for(var i=0; i<jsonResponse.length; i++){
        var tile = jsonResponse[i];
        var thisState = tasks.features;
        // Mapped is done and Validated is validated
        // https://tasks.hotosm.org/api-docs/swagger-ui/index.html?url=https://tasks.hotosm.org/api/docs#/
        if(taskStatus === Mapped || taskStatus === Validated) {
          var tileProp = {
            "task": thisTask["properties.taskId"],
            "state": taskStatus
          };
          tasksFc.features.push(turf.feature(geometry, tileProp));
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
