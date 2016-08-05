var fs = require('fs');
var d3 = require('d3');
var path = require('path');
var flow = require('flow');
var request = require('request');
var converter = require('json-2-csv');
var moment = require("moment");


var timestamp = moment().format('YYYYMMDD-HHmmss');
var data = [];

var getUsers = function(cb){
  request({
    method: 'GET',
    uri: "http://osmstats.redcross.org/users"
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      data = JSON.parse(body);
      cb();
    } else {
      console.log("ERROR: failed to fetch users data")
    }
  });
}

var fetchUserData = function(userIndex, cb){
  var thisUser = data[userIndex]["id"];
  request({
    method: 'GET',
    uri: "http://osmstats.redcross.org/users/" + thisUser
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var jsonResponse = JSON.parse(body);
      var times = []
      for(var i=0; i<jsonResponse["edit_times"].length; i++){
          times.push(new Date(jsonResponse["edit_times"][i]));
      }
      data[userIndex]["first_edit"] = d3.min(times);
      console.log("processed edit_times for: " + thisUser);
      // console.log(JSON.stringify(data[userIndex]));
      cb();
    } else {
      console.log("ERROR: failed getting user data for: " + thisUser)
      console.log("ERROR: " + error )
      cb();
    }
  });
}

var throttleUsers = function(cb){
  var targetCount = 0;
  var counter = 0;
  var targetCount = data.length;
  for (var i=0;i<targetCount;i++) {
     (function(ind) {
         setTimeout(function(){
           // # # # throttle process to limit the speed of calls to download files from the server
           fetchUserData(ind, function(){
             counter ++;
             if(counter === targetCount){ cb(); }
           });
         }, 500 + (100 * ind));
     })(i);
  }
}

var parseContributors = flow.define(
  function(){
    getUsers(this);
  }
  ,function(users){
    throttleUsers(this);
  }
  ,function(){
    var options = {
      delimiter: {
        wrap: '"' // Double Quote (") character
      }
    }
    converter.json2csv(data, function(err, csv){
      var filePath = path.join(__dirname,"output", "output_user-start_" + timestamp + ".csv");
      fs.writeFile(filePath, csv);
    }, options);
  }
);

parseContributors();
