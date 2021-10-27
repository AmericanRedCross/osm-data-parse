this takes a list of project #s for the HOT Tasking manager
(create a `./task-check/files/projects.csv` file for the list)
and outputs a CSV file with the following columns:

- project #
- task #
- task status
- task centroid longitude
- task centroid latitude
- a URL to open iD editor to the task area and load the GPX extent for it

i'm using this to get all the tasks from a set of projects, and then selecting a sample for manual inspection in order to check quality of mapathon data