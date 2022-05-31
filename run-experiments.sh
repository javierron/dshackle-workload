#!/bin/bash

BIN="./main.js"
N=100000

# latency target/workload getBlockByNumber

# for TARGET in dshackle geth besu
# do
#     for EXP in sequential cache random
#     do
#         # reset target
#         # sleep 15m
#         echo "Running: node ./main.js $EXP --target $TARGET --limit $N"
#         node ./main.js $EXP --target $TARGET --limit $N
#     done

# done

# latency random workload

for TARGET in dshackle geth besu
do
    # reset target
    # sleep 15m
    echo "Running: node ./main.js all-methods --target $TARGET --times $N"
    node ./main.js all-methods --target $TARGET --times $N
done