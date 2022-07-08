const { spawn, spawnSync } = require('child_process');
const fs = require('fs')
const http = require('http');
const { exit } = require('process');

require('toml-require').install();
const debug = require('./config.toml').debug

const debugPrint = str => {
  if (debug) {
    console.log(str)
  }
}

const getRandomInt = max => {
  return Math.floor(Math.random() * max);
}

const requests = require('./requests').workload_source




const sendRequest = (target, requestPayload) => {
  return new Promise((resolve, _) => {

    const options = {
      hostname: target.host,
      port: target.port,
      path: target.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 100,
    }

    var resolved = false
    const resolveOnce = data => {
      if (!resolved) {
        resolved = true
        resolve(data)
      }
    }

    const payloadStr = JSON.stringify(requestPayload)

    // var startTime = process.hrtime()
    const req = http.request(options, res => {
      var responseStr = ""

      res.on('data', d => {
        responseStr += d
      })

      res.on('end', () => {
        const responseJson = JSON.parse(responseStr)

        if (responseJson.error) {
          resolveOnce(`${requestPayload.method}: FAIL - ${JSON.stringify(responseJson.error)}`)
        } else {
          resolveOnce(`${requestPayload.method}: OK - ${JSON.stringify(responseJson.result)}`.slice(0, 80))
        }
      })
    })

    req.on('timeout', () => {
      resolveOnce(`${requestPayload.method}: FAIL - TIMEOUT`)
    })

    req.on('error', error => {
      resolveOnce(`${requestPayload.method}: FAIL - ${error}`)
    })

    req.write(payloadStr)
    req.end()
  })

}

const run = async (host, port, length) => {

  console.log('Starting workload')

  const target = {
    host,
    port,
    path: '/'
  }

  var inc = 1
  if(!length) {
    length = 1
    inc = 0
  }

  for (var i = 0; i < length; i += inc) {

    const data = requests[getRandomInt(requests.length)]
    await sendRequest(target, data).then(debugPrint)
  }
}


// main
require('yargs/yargs')(process.argv.slice(2))
  .usage('usage: $0 --host --port --length')
  .command({
    command: 'run',
    desc: 'run the worload on target host and port',
    builder: yargs => yargs
      .demandOption(['host'])
      .demandOption(['port']),
    handler: argv => {
      run(argv.host, argv.port, argv.length)
    }
  })
  .demandCommand()
  .help()
  .argv