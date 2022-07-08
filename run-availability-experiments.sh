#!/bin/bash

NODE="/home/javier/.nvm/versions/node/v16.15.0/bin/node"
N=100000

# $NODE ./availability.js standalone --length $N

# sleep 30

$NODE ./availability.js dshackle --length $N