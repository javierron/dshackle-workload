# import the required library
import pandas as pd
import matplotlib.pyplot as plt


dfs = []
for target in ['besu', 'geth', 'dshackle']:
    # load the dataset
    dfx = pd.read_csv(f"block-read-{target}-{exp}.csv")
    dfx.columns = ["method", "data", "latency"]
    dfx.insert(0, "client", target, True)
    dfx = dfx.drop(columns=['data'])

    dfs.append(dfx)

df = pd.concat(dfs)
df['latency_ms'] = df['latency'].map(lambda x: x / 1000000)


# positions = []
# for x in [1, 2, 3]:
#     positions.append(x - 0.16)
#     positions.append(x)
#     positions.append(x + 0.16)

plot = df.boxplot(
    by=['method', 'client'],
    column=['latency_ms'],
    return_type='both',
    patch_artist=True,
    # positions=positions,
    showfliers=False,
    grid=False,
    widths=0.125
)


# colors = ['b', 'g', 'r', 'b', 'g', 'r', 'b', 'g', 'r']
# for row_key, (ax, row) in plot.iteritems():
#     for i, box in enumerate(row['boxes']):
#         box.set_facecolor(colors[i])
#         box.set_edgecolor('black')
#     for i, median in enumerate(row['medians']):
#         median.set_color('black')

# plt.xticks([1, 2, 3], ['cache', 'random', 'sequential'])
# plt.ylabel('latency (ms)')
# plt.xlabel('')
# plt.suptitle('Latency of \'getBlockByNumber\' call on Ethereum clients')
# plt.title(' ')

# plt.legend(row['boxes'][0:3], ['besu', 'dshackle', 'geth'])

plt.show()
