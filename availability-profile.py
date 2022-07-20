import os
import pandas as pd
from tabulate import tabulate

target = os.environ["TARGET"]

df = pd.read_csv(f'./data/{target}/1/availability-{target}.csv', names=['method', 'return_code', 'result'])
methods = df.groupby(['method'])['method'].count().reset_index(name='count').filter(items=['method'])

for n in ['1','2','3']:

    df = pd.read_csv(f'./data/{target}/{n}/availability-{target}.csv', names=['method', 'return_code', 'result'])

    total = df.groupby(['method'])['method'].count()
    grp_by_method = df.groupby(['method','return_code'])['method'].count().reset_index(name='count')
    total = df.groupby(['method'])['method'].count().reset_index(name='total')

    join = pd.merge(grp_by_method, total, on=['method'])
    join[f'percentage-{n}'] = join['count'] / join['total']

    successes = join[join['return_code'] == '200'].reset_index()

    final = successes.filter(items=['method', f'percentage-{n}'])
    methods = methods.merge(final, on='method')

items = []
for i in methods.index:
    items.append(methods.loc[i].to_json())

print('[' + ','.join(items) + ']', file=f'./data/{target}/profiles.json')
print(tabulate(methods), file=f'./data/{target}/profiles-table.txt')

