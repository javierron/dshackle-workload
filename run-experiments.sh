#!/bin/bash

BIN="./main.js"
N=100000

for TARGET in dshackle geth besu
do
    for EXP in sequential cache random
    do
        # reset target
        # sleep 15m
        echo "Running: node ./main.js $EXP --target $TARGET --limit $N"
        node ./main.js $EXP --target $TARGET --limit $N
    done

done

