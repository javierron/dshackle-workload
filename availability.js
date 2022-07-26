const { spawn, spawnSync } = require('child_process');
const fs = require('fs')
const http = require('http');
const { exit } = require('process');
const { stringify } = require('querystring');

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
  erigon: {
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


var fail_counter = 0

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
        if (data.includes('OK')) {
          fail_counter = 0
        } else {
          fail_counter += 1
        }
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
            if (responseJson.result.number) {
              const clientBlockNumber = Number(responseJson.result.number)
              // console.log(`response number ${clientBlockNumber} vs etherscan number ${blockNumber}`)
              const distance = Math.abs(parseInt(clientBlockNumber) - blockNumber)
              const timestamp = Math.floor(Date.now() / 1000)
              file.write(`${timestamp},${requestPayload.method},${res.statusCode},payload-ok,${distance}\n`)
            }
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

const idx = process.env.IDX


const clients = [
  {
    name: 'geth',
    path: '/home/javier/go-ethereum/build/bin',
    cmd: 'geth',
    args: ['--datadir=/home/javier/go-ethereum/data-dir', '--http', '--http.port=8546', '--http.addr=172.17.0.1'],
    log: 'geth-mainnet.log',
    error_model: `/home/javier/royal-chaos/chaoseth/experiments/go-ethereum/error_models_processed_${idx}.json`
  },
  {
    name: 'besu',
    path: '/home/javier/besu/build/install/besu/bin',
    cmd: './besu',
    args: ['--rpc-http-enabled', '--rpc-http-host=172.17.0.1', '--data-path=/home/javier/besu/data-dir', '--host-allowlist=*', '--p2p-port=30304'],
    log: 'besu-mainnet.log',
    error_model: `/home/javier/royal-chaos/chaoseth/experiments/besu/error_models_processed_${idx}.json`
  },
  {
    name: 'erigon',
    path: '/home/javier/erigon/build/bin',
    cmd: './erigon',
    args: ['--datadir=/home/javier/erigon/build/bin/data-dir', '--prune=hrtc', '--chain=mainnet', '--http.addr=172.17.0.1', '--private.api.addr=127.0.0.1:9091'],
    log: 'erigon-mainnet.log',
    error_model: `/home/javier/royal-chaos/chaoseth/experiments/erigon/error_models_processed_${idx}.json`
  }
]


const availabilityStandalone = async length => {

  const waitTime = 15 * 60 * 1000 // 15 min

  console.log('Starting experiment')

  for (var i = 0; i < clients.length; i++) {


    const target = clients[i]
    var logStream = fs.createWriteStream(`./data/${target.name}/${idx}/${target.name}.log`, { flags: 'a' });
    var injectorLogStream = fs.createWriteStream(`./data/${target.name}/${idx}/${target.name}-injector.log`, { flags: 'a' });

    var targetProcess = spawn(`${target.path}/${target.cmd}`, target.args)
    targetProcess.stdout.pipe(logStream)
    targetProcess.stderr.pipe(logStream)
    var pid = targetProcess.pid

    if (!pid) {
      console.log(`could not start ${target.name}`)
      exit()
    }
    console.log(`spawned ${target.name} with pid ${pid}`)

    console.log(`waiting ${waitTime / 1000} seconds for sync`)
    await new Promise(resolve => setTimeout(resolve, waitTime));

    var chaosethArgs = [
      '-p', `${pid}`,
      '--config', `${target.error_model}`
    ]
    var chaoseth = spawn('sudo', ['/home/javier/royal-chaos/chaoseth/syscall_injector.py', ...chaosethArgs])
    chaoseth.stdout.pipe(injectorLogStream)
    chaoseth.stderr.pipe(injectorLogStream)
    console.log(`attaching ChaosETH to ${target.name} with pid ${pid}, error model ${target.error_model}`)

    //run workload
    const file = fs.createWriteStream(`./data/${target.name}/${idx}/availability-${target.name}.csv`)
    for (var k = 0; k < length; k++) {
      const data = requests[getRandomInt(requests.length)]
      await sendRequest(target.name, data, file, k).then(debugPrint)


      var stat_failed = false

      await statPid(pid).catch(_ => {
        stat_failed = true
      })

      const fail_limit = 5
      //check for x consecutive failures
      if (stat_failed || fail_counter >= fail_limit) {

        logStream.close()
        injectorLogStream.close()

        var logStream = fs.createWriteStream(`./data/${target.name}/${idx}/${target.name}.log`, { flags: 'a' });
        var injectorLogStream = fs.createWriteStream(`./data/${target.name}/${idx}/${target.name}-injector.log`, { flags: 'a' });

        console.log('restarting client...')
        targetProcess.kill('SIGKILL')
        spawn('sudo', ['pkill', '-9', 'syscall_inj'])

        await new Promise(resolve => setTimeout(resolve, 10 * 1000));


        targetProcess = spawn(`${target.path}/${target.cmd}`, target.args)
        targetProcess.stdout.pipe(logStream)
        targetProcess.stderr.pipe(logStream)

        pid = targetProcess.pid

        if (!pid) {
          console.log('Failed to restart client')
        }

        console.log(`waiting ${waitTime / 1000} seconds for sync`)
        await new Promise(resolve => setTimeout(resolve, waitTime));
        console.log('DONE!')


        chaosethArgs = [
          '-p', `${pid}`,
          '--config', `${target.error_model}`
        ]

        chaoseth = spawn('sudo', [`/home/javier/royal-chaos/chaoseth/syscall_injector.py`, ...chaosethArgs])

        if (!chaoseth.pid) {
          console.log('Failed to reattach chaoseth')
        }

        chaoseth.stdout.pipe(injectorLogStream)
        chaoseth.stderr.pipe(injectorLogStream)
      }
    }

    file.close()

    targetProcess.kill('SIGKILL')
    spawn('sudo', ['pkill', '-9', 'syscall_inj'])

    logStream.close()
    injectorLogStream.close()
    console.log(`waiting 30 seconds for cleanup`)
    await new Promise(resolve => setTimeout(resolve, 30 * 1000));
  }
}


var stop = false
var blockNumber = 0

const startTimer = async duration => {
  await new Promise(resolve => setTimeout(resolve, duration));
  stop = true
}

const doRequests = async name => {
  const target = clients.filter(c => c.name == name)[0] // find target by name

  //run workload
  const file = fs.createWriteStream(`./data/${target.name}/time/${idx}/availability-time-${target.name}.csv`)

  const data = requests[0]
  data.params = ['latest', false]

  //if stop return
  while (!stop) {
    //request
    sendRequest(target.name, data, file, 0).then(debugPrint)

    //wait 200 ms
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  file.close()
}

const getLatestBlockNumber = async () => {
  while (!stop) {
    const time = Math.floor(Date.now() / 1000)
    console.log(`TIME: ${time}`)

    const options = {
      hostname: 'api.etherscan.io',
      port: '80',
      path: `/api?module=block&action=getblocknobytime&timestamp=${time}&closest=before&apikey=<ETHERSCAN_API_KEY>`
    }

    //request to etherscan
    const req = http.request(options, res => {
      var responseStr = ""

      res.on('data', d => {
        responseStr += d
      })

      res.on('end', () => {
        const responseJson = JSON.parse(responseStr)
        console.log(`Etherscan resp: ${responseStr}`)
        blockNumber = parseInt(responseJson.result)
      })
    })

    req.end()

    //wait 5 sec
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

const spawnAndCheckforCrash = async name => {
  const spawnWaitTime = 30 * 1000 // 1 min

  console.log('Starting experiment')

  //spawn attach
  const target = clients.filter(c => c.name == name)[0] // find target by name
  var logStream = fs.createWriteStream(`./data/${target.name}/time/${idx}/${target.name}.log`, { flags: 'a' });
  var injectorLogStream = fs.createWriteStream(`./data/${target.name}/time/${idx}/${target.name}-injector.log`, { flags: 'a' });

  var targetProcess = spawn(`${target.path}/${target.cmd}`, target.args)
  targetProcess.stdout.pipe(logStream)
  targetProcess.stderr.pipe(logStream)
  var pid = targetProcess.pid

  if (!pid) {
    console.log(`could not start ${target.name}`)
    exit()
  }
  console.log(`spawned ${target.name} with pid ${pid}`)

  const firstStart = spawnWaitTime * 60 * 2 // two hour sync at startup
  console.log(`waiting ${firstStart / 1000} seconds for startup`)
  await new Promise(resolve => setTimeout(resolve, firstStart));

  var chaosethArgs = [
    '-p', `${pid}`,
    '--config', `${target.error_model}`
  ]
  var chaoseth = spawn('sudo', ['/home/javier/royal-chaos/chaoseth/syscall_injector.py', ...chaosethArgs])
  chaoseth.stdout.pipe(injectorLogStream)
  chaoseth.stderr.pipe(injectorLogStream)
  console.log(`attaching ChaosETH to ${target.name} with pid ${pid}, error model ${target.error_model}`)

  //if crash or non-response
  //spawn attach
  while (!stop) {
    var stat_failed = false
    await statPid(pid).catch(_ => {
      stat_failed = true
    })

    const fail_limit = 5
    //check for x consecutive failures
    if (stat_failed || fail_counter >= fail_limit) {

      logStream.close()
      injectorLogStream.close()

      var logStream = fs.createWriteStream(`./data/${target.name}/time/${idx}/${target.name}.log`, { flags: 'a' });
      var injectorLogStream = fs.createWriteStream(`./data/${target.name}/time/${idx}/${target.name}-injector.log`, { flags: 'a' });

      console.log('restarting client...')
      targetProcess.kill('SIGKILL')
      spawn('sudo', ['pkill', '-9', 'syscall_inj'])

      await new Promise(resolve => setTimeout(resolve, 10 * 1000));


      targetProcess = spawn(`${target.path}/${target.cmd}`, target.args)
      targetProcess.stdout.pipe(logStream)
      targetProcess.stderr.pipe(logStream)

      pid = targetProcess.pid

      if (!pid) {
        console.log('Failed to restart client')
      }

      console.log(`waiting ${spawnWaitTime / 1000} seconds for startup`)
      await new Promise(resolve => setTimeout(resolve, spawnWaitTime));
      console.log('DONE!')


      chaosethArgs = [
        '-p', `${pid}`,
        '--config', `${target.error_model}`
      ]

      chaoseth = spawn('sudo', [`/home/javier/royal-chaos/chaoseth/syscall_injector.py`, ...chaosethArgs])

      if (!chaoseth.pid) {
        console.log('Failed to reattach chaoseth')
      }

      chaoseth.stdout.pipe(injectorLogStream)
      chaoseth.stderr.pipe(injectorLogStream)
    }
    //check every second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  //if stop
  //stop and exit

  targetProcess.kill('SIGKILL')
  spawn('sudo', ['pkill', '-9', 'syscall_inj'])

  logStream.close()
  injectorLogStream.close()
  console.log(`waiting 30 seconds for cleanup`)
  await new Promise(resolve => setTimeout(resolve, 30 * 1000));
}

const availabilityStandaloneTime = async (name, duration) => {

  spawnAndCheckforCrash(name)
  getLatestBlockNumber()
  startTimer(duration * 1000)
  doRequests(name)
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
  }).command({
    command: 'standalone-time',
    desc: 'test time-based availability',
    builder: yargs => yargs
      .demandOption(['name'])
      .describe('name', 'Client name')
      .demandOption(['duration'])
      .describe('duration', 'Time in seconds'),
    handler: argv => {
      availabilityStandaloneTime(argv.name, argv.duration)
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
