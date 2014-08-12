var GitHubApi = require("github");
var debug     = require("debug");

var debuggers                 = {};
var data                      = {};
var missingPackageFile        = [];
var dependenciesToManage      = [];
var expectedCalls, callsCount = 0;


var createDebugger = function(name) {
  if (!debuggers[name]) {
    debuggers[name] = debug('repo-explorer-' + name);
  }
  return debuggers[name];
};

var processRepoContents = function(repo) {
  return function(err, contents) {
    callsCount++;
    var d = createDebugger('process-contents');
    if (err && err.code === 404) {
      missingPackageFile.push(repo.name);
      return d('Unable to find package.json file for repo %s', repo.name);
    }
    if (err || !contents) {
      return console.error(err || new Error("No contents. No errors..."));
    }
    var responseString = new Buffer(contents.content, 'base64').toString('ascii');
    var npmPackage;
    try {
      npmPackage = JSON.parse(responseString);
    } catch (error) {
      console.error('Error : %s\nUnable to parse :\n%s', error, responseString);
      process.exit(-1);
    }
    d('Version of %s is %s', repo.name, npmPackage.version);
    var packageName = npmPackage.name;
    if (packageName !== repo.name) {
      d('Repo name is different from package name : %s / %s', repo.name, packageName);
    }

    if (data[packageName]) {
      console.error('Woah... already seen this repo...');
      process.exit(-1);
    }

    data[packageName] = {
      name         : repo.name,
      packageName  : packageName,
      version      : npmPackage.version
    };

    dependenciesToManage.forEach(function(dep) {
      data[packageName][dep] = npmPackage[dep];
    });
  };
};

var fetchDependencies = function(conf, done) {
  var reposFromOrg = {
    org:      "sutoiku",
    type:     "all",
    per_page: 100
  };

  var github = new GitHubApi({
      version: "3.0.0",
      timeout: 5000
  });

  dependenciesToManage = dependenciesToManage.concat(conf.dependenciesToManage);

  github.authenticate({
    type: "oauth",
    token: conf.token
  });


  github.repos.getFromOrg(reposFromOrg, function(err, repos) {
    if (err || !repos) {
      expectedCalls = 0;

      if (err.toString().match(/Bad credentials/)) {
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("Unable to log in to GitHub, please review your configuration.");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        process.exit();
      }
      throw err;
    }
    expectedCalls = repos.length;
    console.log("Found %d repos.", repos.length);
    var repo;
    var d = createDebugger('getFromOrg');
    for (var i = 0; i < repos.length; ++i) {
      repo = repos[i];
      d('Processing %s...', repo.name);
      github.repos.getContent(
      {
        "user": "sutoiku",
        "repo": repo.name,
        "path": "package.json"
      }, processRepoContents(repo));
    }
  });

  var waitForRepositoriesProcessing = function() {
    if (callsCount !== expectedCalls) {
      return setTimeout(waitForRepositoriesProcessing, 200);
    }
    done(null, {
      dependencies       : data,
      missingPackageFile : missingPackageFile,
      repositoriesCount  : expectedCalls
    });
  };

  setTimeout(waitForRepositoriesProcessing, 200);
};

exports.fetchDependencies = fetchDependencies;