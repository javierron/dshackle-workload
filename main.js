const https = require('https');
const argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 -host [str] -port [num] -times [num]')
    .demandOption(['host', 'port', 'times'])
    .argv;

const workload_source = [
        {
            method: "eth_getBlockByNumber",
            id: 1,
            params: ["0xE1AF7F", false]
        }
    ]


const getRandomInt = max => {
    return Math.floor(Math.random() * max);
}

const data = JSON.stringify(
    workload_source[getRandomInt(workload_source.length)]
);

const options = {
  hostname: argv.host,
  port: argv.port,
  path: '/eth',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
};

[...Array(argv.times).keys()].forEach(_ => {
    const req = https.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`);
      
        res.on('data', d => {
          process.stdout.write(d);
        });
      });
      
      req.on('error', error => {
        console.error(error);
      });
      
      req.write(data);
      req.end();
});


