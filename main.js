const { time } = require('console');
const http = require('http');

require('toml-require').install();
const config = require('./config.toml')
const requests = require('./requests').workload_source


const getRandomInt = max => {
  return Math.floor(Math.random() * max);
}

const sendRequest = (requestPayload) => {
  return new Promise((resolve, _) => {

    const options = {
      hostname: config.connection.host,
      port: config.connection.port,
      path: '/eth',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
    }

    const payloadStr = JSON.stringify(requestPayload)
    const req = http.request(options, res => {

      var responseStr = ""
      res.on('data', d => {
        responseStr += d
      })

      res.on('end', () => {
        // console.log(responseStr)

        const responseJson = JSON.parse(responseStr)
        if (responseJson.error) {
          resolve(`${requestPayload.method}: FAIL - ${JSON.stringify(responseJson.error)}`)
        } else {
          resolve(`${requestPayload.method}: OK - ${JSON.stringify(responseJson.result)}`.slice(0, 80))
        }

      })
    })

    req.on('error', error => {
      // console.log(error)
      resolve(`${requestPayload.method}: FAIL - ${error}`)
    })

    req.write(payloadStr)
    req.end()
  })

}

const testPass = () => {
  requests.forEach(item => {
    sendRequest(item).then(console.log)
  })
}

const randomPass = async times => {

  for (var i = 0; i < times; i++) {
    const data = requests[getRandomInt(requests.length)]
    sendRequest(data).then(console.log)
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}


// main
require('yargs/yargs')(process.argv.slice(2))
  .usage('usage: $0 <command>')
  .command('test', 'test the json payloads', argv => {
    testPass()
  })
  .command({
    command: 'random <times>',
    desc: 'execute random workload',
    builder: yargs => yargs.default('times', 10),
    handler: argv => {
      randomPass(argv.times)
    }
  })
  .demandCommand()
  .help()
  .argv