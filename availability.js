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

const statPid = pid => {
  return new Promise((resolve, reject) => {
    fs.stat(`/proc/${pid}`, (error, stat) => {
      if (error) {
        reject(error)
      }
      resolve(stat)
    })
  })
}


const sendRequest = (target, requestPayload, file, k) => {
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
      timeout: 100,
    }

    var resolved = false
      const resolveOnce = data => {
        if (!resolved) {
          resolved = true
          file = null
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
          if (file) {
            file.write(`${requestPayload.method},${res.statusCode},payload-error\n`)
          }
          resolveOnce(`${requestPayload.method}: FAIL - ${JSON.stringify(responseJson.error)}`)
        } else {
          if (file) {
            file.write(`${requestPayload.method},${res.statusCode},payload-ok\n`)
          }
          resolveOnce(`${requestPayload.method}: OK - ${JSON.stringify(responseJson.result)}`.slice(0, 80))
        }

      })
    })



    req.on('timeout', () => {
      if (file) {
        file.write(`${requestPayload.method},TIMEOUT\n`)
      }
      resolveOnce(`${requestPayload.method}: FAIL - TIMEOUT`)
    })

    req.on('error', error => {
      if (file) {
        file.write(`${requestPayload.method},ERROR\n`)
      }
      resolveOnce(`${requestPayload.method}: FAIL - ${error}`)
    })

    req.write(payloadStr)
    req.end()
  })

}

const clients = [
  {
    name: 'geth',
    path: '/home/javier/go-ethereum/build/bin',
    cmd: 'geth',
    args: ['--datadir=/home/javier/go-ethereum/data-dir', '--http', '--http.port=8546', '--http.addr=172.17.0.1'],
    log: 'geth-mainnet.log'
  },
  {
    name: 'besu',
    path: '/home/javier/besu/build/install/besu/bin',
    cmd: './besu',
    args: ['--rpc-http-enabled', '--rpc-http-host=172.17.0.1', '--data-path=/home/javier/besu/build/install/besu/bin/~/besu/data-dir', '--host-allowlist=*', '--p2p-port=30304'],
    log: 'besu-mainnet.log'
  }
]

const availabilityStandalone = async length => {

  const errorModelStr = fs.readFileSync('./error-model.json')
  const errorModel = JSON.parse(errorModelStr)
  const waitTime = 2 * 60 * 1000 // 60 sec

  console.log('Starting experiment')

  for (var i = 0; i < clients.length; i++) {
    const target = clients[i]
    console.log(target.name)

    const errorModels = errorModel.experiments
    for (var j = 0; j < errorModels.length; j++) {

      const targetProcess = spawn(`${target.path}/${target.cmd}`, target.args, { stdio: [process.stdin, process.stdout, process.stderr] })
      const pid = targetProcess.pid

      if (!pid) {
        console.log(`could not start ${target.name}`)
        exit()
      }
      console.log(`spawned ${target.name} with pid ${pid}`)

      console.log(`waiting ${waitTime / 1000} seconds for sync`)
      await new Promise(resolve => setTimeout(resolve, waitTime));

      const errorModel = errorModels[j]
      const chaosethArgs = [
        '-p', `${pid}`,
        '-P', `${errorModel.failure_rate}`,
        `--errorno=${errorModel.error_code}`,
        `${errorModel.syscall_name}`
      ]
      const chaoseth = spawn(`/home/javier/royal-chaos/chaoseth/syscall_injector.py`, chaosethArgs,
        { stdio: [process.stdin, process.stdout, process.stderr] })
      const errorModelStr = `${errorModel.syscall_name}-${errorModel.error_code}-${errorModel.failure_rate}`
      console.log(`attaching ChaosETH to ${target.name} with pid ${pid}, error model ${errorModelStr}`)

      //run workload
      const file = fs.createWriteStream(`./data/availability-${target.name}-${errorModelStr}.csv`)
      for (var k = 0; k < length; k++) {
        const data = requests[getRandomInt(requests.length)]
        await sendRequest(target.name, data, file, k).then(debugPrint)

        await statPid(pid).catch(_ => {
          file.write('CRASH!\n')
          k = length //break request loop
        })
      }

      file.close()

      chaoseth.kill('SIGKILL')
      targetProcess.kill('SIGKILL')

      console.log(`waiting 30 seconds for cleanup`)
      await new Promise(resolve => setTimeout(resolve, 30 * 1000));
    }
  }
}

const availabilityDshackle = async length => {
  const dshackle = {
    name: 'dshackle',
    path: './',
    cmd: 'docker',
    args: ['run', '--name', 'dshackle', '--expose', '8080', '-v', '/home/javier/dshackle:/config', '-w', '/config', 'emeraldpay/dshackle:0.12'],
  }

  const dshackle_remove = {
    name: 'dshackle_remove',
    path: './',
    cmd: 'docker',
    args: ['rm', '-f', 'dshackle'],
  }

  const errorModelStr = fs.readFileSync('./error-model.json')
  const errorModel = JSON.parse(errorModelStr)
  const waitTime = 60 * 1000 // 60 sec

  console.log('Starting experiment')

  //for each error model
  const errorModels = errorModel.experiments
  for (var j = 0; j < errorModels.length; j++) {

    //spawn clients
    const processes = []
    const pids = []
    for (var i = 0; i < clients.length; i++) {
      const client = clients[i]
      console.log(client.name)


      const clientProcess = spawn(`${client.path}/${client.cmd}`, client.args)

      if (!clientProcess.pid) {
        console.log(`could not start ${client.name}`)
        exit()
      }
      console.log(`spawned ${client.name} with pid ${clientProcess.pid}`)

      processes.push(clientProcess)
      pids.push(clientProcess.pid)
    }

    console.log(`waiting ${waitTime / 1000} seconds for sync`)
    await new Promise(resolve => setTimeout(resolve, waitTime));

    //spawn dshackle
    const dshackleProc = spawn(dshackle.cmd, dshackle.args)

    console.log(`waiting ${waitTime / 1000} seconds for dshackle startup`)
    await new Promise(resolve => setTimeout(resolve, waitTime));

    const errorModel = errorModels[j]
    const pidParams = pids.reduce((arr, p) => arr.concat(['-p', `${p}`]), [])
    const chaosethArgs = pidParams.concat([
      '-P', `${errorModel.failure_rate}`,
      `--errorno=${errorModel.error_code}`,
      `${errorModel.syscall_name}`
    ])
    const chaoseth = spawn(`/home/javier/royal-chaos/chaoseth/syscall_injector.py`, chaosethArgs,
      { stdio: [process.stdin, process.stdout, process.stderr] })
    const errorModelStr = `${errorModel.syscall_name}-${errorModel.error_code}-${errorModel.failure_rate}`
    console.log(`attaching ChaosETH to pids ${pids}, error model ${errorModelStr}`)

    //run workload
    const file = fs.createWriteStream(`./data/availability-dshackle-${errorModelStr}.csv`)
    for (var k = 0; k < length; k++) {
      const data = requests[getRandomInt(requests.length)]
      await sendRequest('dshackle', data, file, k).then(debugPrint)

      // await statPid(pid).catch(_ => {
      //   file.write('CRASH!\n')
      //   k = length //break request loop
      // })
    }

    file.close()

    chaoseth.kill('SIGKILL')
    processes.forEach(p => p.kill('SIGKILL'))
    
    // dshackleProc.kill('SIGKILL')
    spawn(dshackle_remove.cmd, dshackle_remove.args)

    console.log(`waiting 30 seconds for cleanup`)
    await new Promise(resolve => setTimeout(resolve, 30 * 1000));
  }
}

// main
require('yargs/yargs')(process.argv.slice(2))
  .usage('usage: $0 --length')
  .command({
    command: 'standalone',
    desc: 'test the json payloads',
    builder: yargs => yargs
      .demandOption(['length']),
    handler: argv => {
      availabilityStandalone(argv.length)
    }
  })
  .command({
    command: 'dshackle',
    desc: 'test the json payloads',
    builder: yargs => yargs
      .demandOption(['length']),
    handler: argv => {
      availabilityDshackle(argv.length)
    }
  })
  .demandCommand()
  .help()
  .argv