### tasking-mgr-projects

Simple node.js script that grabs basic details on all projects from the [HOT tasking manager](tasks.hotosm.org) (filtered based on the searching the project name for a text string) and saves out as a CSV. Optionally also creates a GeoJSON of all task features marked as completed or validated).

- download or clone this project repository
- install [`nvm`](https://github.com/creationix/nvm) to manage node versions on your system
- run `nvm use` to read the '.nvmrc' file and switch to the correct version of node (8.10.0)
- run `npm install` in the folder
- run `node parse.js`
- provide run time parameters when prompted