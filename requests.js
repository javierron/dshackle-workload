require('toml-require').install();
config = require('./config.toml')

const workload_source = [
    {
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      id: 1,
      params: [config.eth.blocknumber, false]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_gasPrice',
      id: 1,
      params: []
    },
    {
      jsonrpc: '2.0',
      method: 'eth_estimateGas',
      id: 1,
      params: [{
        "to": "0x5657a2B688506c4f7408e28A28D7ACA4752b00ce",
        "value": "0x1"
      }, "pending"]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getBlockTransactionCountByHash',
      id: 1,
      params: [config.eth.blockhash]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getUncleCountByBlockHash',
      id: 1,
      params: [config.eth.blockhash]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getBlockByHash',
      id: 1,
      params: [config.eth.blockhash, false]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getTransactionByHash',
      id: 1,
      params: [config.eth.transactionhash]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getTransactionByBlockHashAndIndex',
      id: 1,
      params: [config.eth.blockhash, '0x0']
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getStorageAt',
      id: 1,
      params: [config.eth.contractaddress, '0x0', "latest"]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getCode',
      id: 1,
      params: [config.eth.contractaddress, 'latest']
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getUncleByBlockHashAndIndex',
      id: 1,
      params: [config.eth.blockhash, '0x0']
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getTransactionCount',
      id: 1,
      params: [config.eth.address, 'latest']
    },
    {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      id: 1,
      params: []
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      id: 1,
      params: [config.eth.address, 'latest']
    },
    // {
    //   jsonrpc: '2.0',
    //   method: 'eth_sendRawTransaction',
    //   id: 1,
    //   params: []
    // },
    {
      jsonrpc: '2.0',
      method: 'eth_getBlockTransactionCountByNumber',
      id: 1,
      params: [config.eth.blocknumber]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getUncleCountByBlockNumber',
      id: 1,
      params: [config.eth.blocknumber]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getTransactionByBlockNumberAndIndex',
      id: 1,
      params: [config.eth.blocknumber, '0x0']
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getTransactionReceipt',
      id: 1,
      params: [config.eth.transactionhash]
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getUncleByBlockNumberAndIndex',
      id: 1,
      params: [config.eth.blocknumber, '0x0']
    },
    {
      jsonrpc: '2.0',
      method: 'eth_feeHistory',
      id: 1,
      params: ['0xf', 'latest', [25, 75]],
    },
    {
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      id: 1,
      params: [{
        "fromBlock" : config.eth.blocknumber,
        "toBlock" : config.eth.blocknumber,
      }]
    }
  ]

module.exports = {
    workload_source
}