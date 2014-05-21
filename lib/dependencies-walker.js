var semver = require('semver');
var fs     = require('fs');

var dependenciesToManage, uncheckedModules = {};
var stats = {}, total = 0;

var safeCompare = function(cmp, v1, v2) {
  return semver.valid(v1) && semver.valid(v2) && semver[cmp](v1, v2);
};

var updateStats = function(info) {
  stats[info] = stats[info] || 0;
  stats[info]++;
  total++;
};

var checkAllDependenciesForPackage = function(repositoriesData, packageName, dependencyType) {
  var dependenciesToCheck     = repositoriesData[packageName][dependencyType];
  var dependenciesNameToCheck = Object.keys(dependenciesToCheck);
  var dependencyName, dependencyDesc;
  var results = [];
  for (var i = 0; i < dependenciesNameToCheck.length; ++i) {
    dependencyName = dependenciesNameToCheck[i];
    dependencyDesc = dependenciesToCheck[dependencyName];
    if (!repositoriesData[dependencyName]) {
      uncheckedModules[dependencyName] = true;
      continue;
    }

    // Version regex : /^\*|[~]{0,1}[0-9.]+[0-9]+$/)
    // Take the last part of the path
    var depFullName  = dependencyDesc.split('/').pop();
    var depDashToken = depFullName.split('-');
    var depName      = depDashToken.slice(0, depDashToken.length - 1).join('-');
    var depVersion   = depDashToken[depDashToken.length - 1];

    if (depVersion.substr(depVersion.length - 4).toLowerCase() === ".tgz") {
      depVersion = depVersion.substr(0, depVersion.length - 4);
    }

    var repositoryVersion = repositoriesData[dependencyName].version;
    var info;
    if (safeCompare("lt", depVersion, repositoryVersion)) {
      info = "OUTDATED";
    } else if (safeCompare("gt", depVersion, repositoryVersion)) {
      info = "FUTURISTIC!!!";
    } else if (safeCompare("eq", depVersion, repositoryVersion) ||
               ['*', 'latest'].indexOf(depVersion) > -1         ||
               depVersion.indexOf('.git') > 0                   ||
               depVersion.indexOf('#master') > 0                ||
               semver.satisfies(repositoryVersion, depVersion)) {
      info = "UP TO DATE";
    } else {
      info = "N/A";
      console.log('Unable to compare specified version "%s" and repository version "%s"'
        , depVersion, repositoryVersion);
    }
    results.push({
      packageName       : packageName,
      dependencyName    : dependencyName,
      dependencyDesc    : dependencyDesc,
      depFullName       : depFullName,
      depName           : depName,
      depVersion        : depVersion,
      repositoryVersion : repositoryVersion,
      info              : info
    });

    updateStats(info);
  }
  return results;
};

var checkAllDependenciesTypesForPackage = function(repositoriesData, packageName) {
  var pkg = repositoriesData[packageName];
  var results = [];
  for (var i = 0; i < dependenciesToManage.length; ++i) {
    if (!pkg[dependenciesToManage[i]]) {
      continue;
    }
    results = results.concat(checkAllDependenciesForPackage(repositoriesData, packageName, dependenciesToManage[i]));
  }
  return results;
};

var writeRecursively = function(fd, results, pos, done) {
  if (pos >= results.length) {
    return done();
  }

  var str = results[pos].join(';') + '\n';
  fs.write(fd, new Buffer(str), 0, str.length, null, function(err) {
    if (err) { return done(err); }
    setImmediate(writeRecursively.bind(null, fd, results, pos + 1, done));
  });
};

var writeResults = function(conf, results, done) {
  fs.readFile(conf.templateFile, function (err, data) {
    if (err) {return done(err); }
    data = data.toString();
    data = data.replace('##UPDATE_TIMESTAMP##', new Date());
    data = data.replace('###INJECT_ME_HERE###', JSON.stringify(results));

    fs.writeFile(conf.outputHTML, data, done);
  });
};

var walkDependencies = function(conf, repositoriesData, done) {
  dependenciesToManage = conf.dependenciesToManage;
  var packages = Object.keys(repositoriesData);
  var results = [];
  for (var i = 0; i < packages.length; ++i) {
    results = results.concat(checkAllDependenciesTypesForPackage(repositoriesData, packages[i]));
  }

  console.log('Stats :');
  for (var k in stats) {
    console.log("\t%s => %s%%", k, Math.round(100 * stats[k] / total));
  }
  writeResults(conf, results, done);
};

exports.walkDependencies = walkDependencies;