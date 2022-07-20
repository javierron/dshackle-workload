#!/bin/bash

export TARGET="besu"

for INDEX in 1 2 3
do
    echo $INDEX start
    date
    export IDX=$INDEX
    node ./availability.js standalone --length 100000
    echo $INDEX end
    date
done

python3 availability-profile.py