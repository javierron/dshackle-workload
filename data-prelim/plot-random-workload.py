# import the required library
import pandas as pd
import matplotlib.pyplot as plt


dfs = []
for target in ['besu', 'geth', 'dshackle']:
    # load the dataset
    dfx = pd.read_csv(f"all-methods-{target}-random.csv")
    dfx.columns = ["method", "data", "latency"]
    dfx.insert(0, "client", target, True)
    dfx = dfx.drop(columns=['data'])

    dfs.append(dfx)

df = pd.concat(dfs)
df['latency_ms'] = df['latency'].map(lambda x: x / 1000000)


positions = []
for x in range(1, 22):
    positions.append(x - 0.16)
    positions.append(x)
    positions.append(x + 0.16)

plot = df.boxplot(
    by=['method', 'client'],
    column=['latency_ms'],
    return_type='both',
    patch_artist=True,
    positions=positions,
    showfliers=False,
    grid=False,
    widths=0.125
)


colors = ['b', 'g', 'r']
for row_key, (ax, row) in plot.iteritems():
    for i, box in enumerate(row['boxes']):
        box.set_facecolor(colors[i%3])
        box.set_edgecolor('black')
    for i, median in enumerate(row['medians']):
        median.set_color('black')

labels = ['getBlockByNumber',
     'gasPrice',
     'estimateGas',
     'getBlockTransactionCountByHash',
     'getUncleCountByBlockHash',
     'getBlockByHash',
     'getTransactionByHash',
     'getTransactionByBlockHashAndIndex',
     'getStorageAt',
     'getCode',
     'getUncleByBlockHashAndIndex',
     'getTransactionCount',
     'blockNumber',
     'getBalance',
     'getBlockTransactionCountByNumber',
     'getUncleCountByBlockNumber',
     'getTransactionByBlockNumberAndIndex',
     'getTransactionReceipt',
     'getUncleByBlockNumberAndIndex',
     'feeHistory',
     'getLogs'
     ]

labels.sort()

plt.xticks(list(range(1, 22)), labels, rotation=45, ha="right", rotation_mode="anchor")
plt.ylabel('latency (ms)')
plt.xlabel(' ')
plt.suptitle('Latency of Etherem client methods')
plt.title('random workload')

plt.legend(row['boxes'][0:3], ['besu', 'dshackle', 'geth'])

plt.show()
