const fs = require('fs')
const path = require('path')
const async = require('async')
const needle = require('needle')
const turf = require('@turf/turf')
const Papa = require('papaparse')

var timeStamp = + new Date();
var fileName = "output_" + timeStamp + ".csv";

function processProject(project, callback){
  async.waterfall([
    function(cb){
      var url = "https://tasking-manager-tm4-production-api.hotosm.org/api/v2/projects/" + project + "/tasks/?as_file=false"
      needle.get(url, function(error, response, body) {
        if (error) throw error;
        // body is an alias for `response.body`,
        // that in this case holds a JSON-decoded object.
        cb(null, body.features)
      });
    },
    function(features, cb){
      var details = []
      async.each(features, function(feature, callback) {
        var center = turf.center(feature);
        var x = center.geometry.coordinates[0];
        var y = center.geometry.coordinates[1];
        var gpxUrl = "https://tasking-manager-tm4-production-api.hotosm.org/api/v2/projects/" + project + "/tasks/queries/gpx/?tasks=" + feature.properties.taskId;
        var editorUrl = "https://ideditor.netlify.app/#map=17/"+ center.geometry.coordinates[1] + "/" + center.geometry.coordinates[0] + "&gpx=" + encodeURIComponent(gpxUrl);
        details = details.concat({
          project: project,
          task: feature.properties.taskId,
          status: feature.properties.taskStatus,
          x: x,
          y: y,
          editorUrl: editorUrl
        })
        callback();
      }, function(err){ 
        cb(err, details)
      });      
    },
    function(details, cb){
      console.log("writing task details for #" + project + " to the csv");
      var csv = Papa.unparse(details, {header: false});
      const outputFile = path.join(__dirname,'output',fileName);
      fs.appendFileSync(outputFile, csv)
      fs.appendFileSync(outputFile, '\n')
      cb();
    }],
    function(err){
      if(err) {
        console.log("error: ", err)
      } else {
        callback(null);
      }
    }
  )
}


async.waterfall([
  function(cb) { // step 1 - grab the csv
    console.log("reading file...");
    fs.readFile('./files/projects.csv', 'utf8', (err, data) => {
      if (err) {
        cb(err)
      }
      console.log("parsing projects csv...");
      // the .replace() below is stripping out the byte order mark (BOM)
      Papa.parse(data.replace(/^\uFEFF/, ""), {
        header: false,
        error: function(error) {
          cb(error)
        },
        complete: function(results) {
          cb(null, results.data)
        }
      });
    })
  },
  function(data, cb) { // step 2 - process projects one at a time
    
    async.eachLimit(data, 1, function(item, callback) {
      console.log("starting on project #", item[0])
      // setTimeout is to not blast the Tasking Manager API too rapidly with requests
      setTimeout(function(){
        processProject(item, callback)
      }, 1000)
    }, function(err){ // # A callback which is called when all `eachLimit` iteratee functions have finished, or an error occurs.
      cb(err)
    })

  }],
  function(err, result){
    if(err) {
      console.log("error:",err)
    } else {
      console.log("done everything?!")
    }
  }
)
