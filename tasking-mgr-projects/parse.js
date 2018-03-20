var Promise = require('bluebird');
var inquirer = require('inquirer');
var request = require('request');
var converter = require('json-2-csv');
var fs = require('fs');
var turf = require('@turf/helpers');
var moment = require('moment');
var path = require('path');

var timestamp = moment().format('YYYYMMDD-HHmmss');

var searchTerm, startProject, maxProject, creatGeo, projectsList;
var matchCollection = [];
var summaryFc = { type: 'FeatureCollection', features: [] };

var questions = [
  {
    type: 'input',
    name: 'searchTerm',
    message: 'Match projects based on what text string? (Project titles will have spaces removed and be lowercased.)',
    default: 'missingmaps'
  },
  {
    type: 'input',
    name: 'startProject',
    message: 'Start with what project number? (For "missingmaps" this can be 718.)',
    validate: function(value) {
      var pass = value.match(
        /^[0-9]+$/
      );
      if (pass) {
        return true;
      }
      return 'Please enter a valid number.';
    }
  },
  {
    type: 'input',
    name: 'maxProject',
    message: 'End with what project number?',
    validate: function(value) {
      var pass = value.match(
        /^[0-9]+$/
      );
      if (pass) {
        return true;
      }
      return 'Please enter a valid number.';
    }
  },
  {
    type: 'confirm',
    name: 'createGeo',
    message: 'Create GeoJSON output?',
    default: true
  }
]

function fetchPrjData(projectNumber) {
  return new Promise((resolve, reject) => {
    request({ method: 'GET',
      uri: "http://tasks.hotosm.org/api/v1/project/" + projectNumber + "/summary"
    },(error, res, body) => {
      if (!error && res.statusCode == 200){
        var jsonResponse = JSON.parse(body);
        if (jsonResponse) {
            var nameCheck = jsonResponse.name.replace(/\s+/g, '').toLowerCase().indexOf(searchTerm);
            if (nameCheck !== -1) {
              var projectObj = {
                "task_number": projectNumber,
                "created" : jsonResponse["created"].slice(0,10),
                "name": jsonResponse["name"].replace(/"/g,""),
                "author": jsonResponse["organisationTag"],
                "status":jsonResponse["status"],
                "done": jsonResponse["percentMapped"],
                "validated": jsonResponse["percentValidated"]
              }
              console.log("match for task :  " + projectNumber);
              matchCollection.push(projectObj);
              resolve(projectObj)
          } else { 
            console.log("no match for   :  " + projectNumber); 
            resolve();
          }
        }
      } else {
        console.log("failed fetchProjectData for :  " + projectNumber)
        console.log(JSON.stringify(res) + '\n' )   
        resolve();
      }
    });
  })
}

var fetchTaskData = function(projectNumber) {
  return new Promise((resolve,reject) => {
    request({
      method: 'GET',
      uri: "https://tasks.hotosm.org/api/v1/project/" + projectNumber
    },(error, res, body) => {
      if (!error && res.statusCode == 200) {
        var jsonResponse = JSON.parse(body);
        var prjFc = jsonResponse.tasks;
        var prjTasks = prjFc.features;
        for (var i=0; i<prjTasks.length; i++) {
          var tile = prjTasks[i];
          var tileState = tile.properties.taskStatus;
          if(tileState === "MAPPED" || tileState === "VALIDATED") {
            var tileProp = {
              "project": jsonResponse.projectId,
              "task": tile.properties.taskId,
              "state": tileState
            };
            summaryFc.features.push(turf.feature(tile.geometry, tileProp));
          }
        }
        console.log("processed tasks for #" + projectNumber);
        resolve();
      } else {
        console.log("failed getting tasks json for #" + projectNumber)
        console.log("error      :  " + error )
        resolve();
      }
    });
  })  
}

function parseTasks() {
  Promise.map(matchCollection, function(matchedPrj) {
    return fetchTaskData(matchedPrj["task_number"]);
  },{ concurrency: 1 }).then(function(resolved) {
    var filePath = path.join(__dirname,"output", "output_" + timestamp + ".geojson");
    fs.writeFile(filePath, JSON.stringify(summaryFc), (err) => {
      if(err) throw err;
      console.log("the GeoJSON has been written!")
    });
  });
}

function parseProjects() {
  Promise.map(projectsList, function(prjNumber) {
    return fetchPrjData(prjNumber);
  },{ concurrency: 1 }).then(function(resolved) {
    var options = {
      delimiter : {
        wrap  : '"', // Double Quote (") character
      }
    }
    converter.json2csv(matchCollection, function(err, csv) {
      var filePath = path.join(__dirname,"output", "output_" + timestamp + ".csv");
      fs.writeFile(filePath, csv, (err) => {
        if (err) throw err;
        console.log("the CSV has been written!")
      });
      if (createGeo == true) { parseTasks(); }
    }, options);
  });
}

inquirer.prompt(questions).then(answers => {
  startProject = parseInt(answers.startProject);
  maxProject = parseInt(answers.maxProject);
  createGeo = answers.createGeo;
  searchTerm = answers.searchTerm;
  projectsList = [];
  for (var i = startProject; i < maxProject+1; ++i) {
    projectsList.push(i);
  }
  parseProjects();
});