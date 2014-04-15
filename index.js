var fetcher = require("./lib/dependencies-fetcher");
var walker  = require("./lib/dependencies-walker");
var fs      = require("fs");
var conf;

try {
  conf = require("./conf");
} catch (e) {
  console.error("You must create a index.json file under conf/ directory.");
  console.error("It must contain your authentication token.");
  process.exit();
}

var walk = function(data) {
  walker.walkDependencies(conf, data, function(err) {
    if (err) { throw err; }
    console.log("That's all, folks!");
  });
};

var data;
if (process.argv[2] !== 'fresh') {
  try {
    data = require(conf.resultFile);
  } catch(e) {}
}

if (!data) {
  console.log('%s result file not found : will connect to GitHub to fetch dependencies.', conf.resultFile);
  fetcher.fetchDependencies(conf, function(err, res) {
    var data = res.dependencies;
    fs.writeFile(conf.resultFile, JSON.stringify(data), function() {
      console.log('Done processing the %d repositories.', res.repositoriesCount);
      if (res.missingPackageFile.length) {
        console.log('We were not able to fetch package.json file from those %d repos :', res.missingPackageFile.length);
        console.log('\t - ' + res.missingPackageFile.join('\n\t - '));
      }
      walk(data);
    });
  });
} else {
  console.log('%s result file found : using it to analyse dependencies.', conf.resultFile);
  walk(data);
}
