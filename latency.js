const { randomInt } = require('crypto');
const fs = require('fs')
const http = require('http');

require('toml-require').install();
const debug = require('./config.toml').debug

const debugPrint = str => {
  if(debug){
    console.log(str)
  }
}

const requests = require('./requests').workload_source

const urls = {
  geth: {
    host: '172.17.0.1',
    port: '8546',
    path: '/'
  },
  besu: {
    host: '172.17.0.1',
    port: '8545',
    path: '/'
  },
  dshackle: {
    host: '172.17.0.2',
    port: '8080',
    path: '/eth'
  }
}

const getRandomInt = max => {
  return Math.floor(Math.random() * max);
}

const sendRequest = (target, requestPayload, file) => {
  return new Promise((resolve, _) => {
    connection = urls[target]
    const options = {
      hostname: connection.host,
      port: connection.port,
      path: connection.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
    }

    const payloadStr = JSON.stringify(requestPayload)

    var startTime = process.hrtime()
    const req = http.request(options, res => {

      var responseStr = ""

      res.on('data', d => {
        responseStr += d
      })

      res.on('end', () => {
        if (file) {
          endTime = process.hrtime(startTime)
          file.write(`${requestPayload.method},${requestPayload.params[0] || null},${endTime[1]}\n`)
        }

        const responseJson = JSON.parse(responseStr)
        if (responseJson.error) {
          resolve(`${requestPayload.method}: FAIL - ${JSON.stringify(responseJson.error)}`)
        } else {
          resolve(`${requestPayload.method}: OK - ${JSON.stringify(responseJson.result)}`.slice(0, 80))
        }

      })
    })

    req.on('error', error => {
      resolve(`${requestPayload.method}: FAIL - ${error}`)
    })


    req.write(payloadStr)
    req.end()
  })

}

const testPass = target => {
  requests.forEach(item => {
    sendRequest(target, item).then(debugPrint)
  })
}

const allMethodsRandom = async (target, times) => {
  const file = fs.createWriteStream(`./data/all-methods-${target}-random.csv`)
  for (var i = 0; i < times; i++) {
    const data = requests[getRandomInt(requests.length)]
    await sendRequest(target, data, file).then(debugPrint)
  }
  file.close()
}

const readBlockExp = async (target, times) => {
  const file = fs.createWriteStream(`./data/block-read-${target}-random.csv`)
  for (var i = 0; i < times; i++) {
    const data = requests[0]
    data.params[0] = `0x${randomInt(13000000).toString(16)}`
    await sendRequest(target, data, file).then(debugPrint)
  }
  file.close()
}

const sequentialPass = async (target, limit) => {
  const file = fs.createWriteStream(`./data/block-read-${target}-sequential.csv`)
  for (var i = 0; i < limit; i++) {
    const data = requests[0]
    data.params[0] = `0x${i.toString(16)}`
    await sendRequest(target, data, file).then(debugPrint)
  }
  file.close()
}

const cachePass = async (target, limit) => {
  const file = fs.createWriteStream(`./data/block-read-${target}-cache.csv`)
  const jump = 100
  const repeat = 100
  for (var i = 0; i < limit; i += jump) {
    const data = requests[0]
    data.params[0] = `0x${(i * jump).toString(16)}`
    for (var j = 0; j < repeat; j++) {
      await sendRequest(target, data, file).then(debugPrint)
    }
  }
  file.close()
}



// main
require('yargs/yargs')(process.argv.slice(2))
  .usage('usage: $0 <command> <target>')
  .command({
    command: 'test',
    desc: 'test the json payloads',
    builder: yargs => yargs
      .choices('target', ['geth', 'besu', 'dshackle'])
      .demandOption(['target']),
    handler: argv => {
      testPass(argv.target)
    }
  })
  .command({
    command: 'all-methods',
    desc: 'execute random workload',
    builder: yargs => yargs
      .default('times', 100)
      .choices('target', ['geth', 'besu', 'dshackle'])
      .demandOption(['times', 'target']),
    handler: argv => {
      allMethodsRandom(argv.target, argv.times)
    }
  })
  .command({
    command: 'sequential',
    desc: 'execute sequential workload',
    builder: yargs => yargs
      .default('limit', 100)
      .choices('target', ['geth', 'besu', 'dshackle'])
      .demandOption(['limit', 'target']),

    handler: argv => {
      sequentialPass(argv.target, argv.limit)
    }
  })
  .command({
    command: 'cache',
    desc: 'execute cache-friendly workload',
    builder: yargs => yargs
      .default('limit', 100)
      .choices('target', ['geth', 'besu', 'dshackle'])
      .demandOption(['limit', 'target']),
    handler: argv => {
      cachePass(argv.target, argv.limit)
    }
  })
  .command({
    command: 'random',
    desc: 'read block experiment',
    builder: yargs => yargs
      .default('times', 10)
      .alias('times', 'limit')
      .choices('target', ['geth', 'besu', 'dshackle'])
      .demandOption(['times', 'target']),
    handler: argv => {
      readBlockExp(argv.target, argv.times)
    }
  })
  .demandCommand()
  .help()
  .argv