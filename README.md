### tm-project-history

Simple node.js script that grabs basic details on all Missing Maps projects from the [HOT tasking manager](tasks.hotosm.org) (filters based on the project name) and saves out a CSV.

Also saves out a GeoJSON of all task features that are marked completed or validated.

Currently setup for our specific use-case. But I plan to make it more configurable.

- download or clone the project
- run `npm install` in the folder
- run `node parse.js`
