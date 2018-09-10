const { spawn } = require('child_process');
const request = require('request');
const test = require('tape');
const parseXml = require('xml2js').parseString;

// Start the app
const env = Object.assign({}, process.env, {PORT: 5000});
const child = spawn('node', ['index.js'], {env});

test('responds to requests', (t) => {
  t.plan(4);

  // Wait until the server is ready
  child.stdout.on('data', _ => {
    // Make a request to our app
    request('http://127.0.0.1:5000', (error, response, body) => {
      // stop the server
      child.kill();

      // No error
      t.false(error);
      // Successful response
      t.equal(response.statusCode, 200);
      // Assert content checks
      t.notEqual(body.indexOf("<title>Node.js Getting Started on Heroku</title>"), -1);
      t.notEqual(body.indexOf("Getting Started with Node on Heroku"), -1);
    });
  });
});

function fzeTestStatus(statusUrl, interval, callback) {
  (function poll() {
    request(fzeStatusUrl, function(error, response, body) {
      parseXml(body, function(err, result) {
        if (typeof(result.response.data[1].returnData) == 'undefined') {
          setTimeout(poll, interval);
        } else {
          callback(result.response.data[1].returnData[0]);
        }
      });
    });
  })();
}

if (typeof(process.env.HEROKU_UAT_APP_WEB_URL) !== 'undefined') {
  const uatAppUrl = process.env.HEROKU_UAT_APP_WEB_URL;
  const fzeDeployId = process.env.FZE_DEPLOYMENT_ID;
  const fzeApiKey = process.env.FZE_API_KEY;
  const fzeOrchUrl = `https://app.functionize.com/api/v1?method=processDeployment&actionFor=execute&deploymentid=${ fzeDeployId }&apiKey=${ fzeApiKey }`;

  test('functionize autonomous uat tests', { timeout: 300000 }, (t) => {
    t.plan(3);

    // TODO: assertions to check presence of id & key?

    t.ok(process.env.HEROKU_UAT_APP_WEB_URL, `UAT URL: ${ uatAppUrl }`);

    request(fzeOrchUrl, function(error, response, body) {
      parseXml(body, function(err, result) {
        t.equal(result.response.status[0], "success", "Deployment launched");
        const fzeRunId = result.response.data[1].run_id[0];
        const fzeStatusUrl = `https://app.functionize.com/api/v1?method=processDeployment&actionFor=status&deploymentid=${ fzeDeployId }&apiKey=${ fzeApiKey }&run_id=${ fzeRunId }`;

        fzeTestStatus(fzeStatusUrl, 2000, function (testResults) {
          t.equal(testResults.Status, "Completed", "Tests completed");
          
          t.comment("Tests passed: " + testResults.passed[0]);
          t.comment("Tests failed: " + testResults.failure[0]);
          t.comment("Test warnings: " + testResults.warning[0]);
      });
    });
  });
}

