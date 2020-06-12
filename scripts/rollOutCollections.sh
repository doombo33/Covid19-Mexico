#!/bin/bash

Date=`date +%Y%m%d -d "1 day ago"`
LOGF="/tmp/process.log"

Path=$1 # /usr/local/nodeapps/Covid19-Mexico-Fetch/extractedData
F=$2 # 200601COVID19MEXICO.csv
Db=$3 # covid19Fetch
Rot=$4 # true / false

file=$Path'/'$F

function addToLog(){
   echo `date $NOW_FMTSTR` $1 >> $LOGF 2>&1
}
echo $file

Rename=`mongo $Db --eval 'db.Sheet1.renameCollection("Sheet1_'$Date'")'`
addToLog $Rename
Create=`mongo $Db --eval 'db.createCollection("Sheet1")'`
addToLog $Create
Import=`mongoimport -d covid19Fetch --collection Sheet1 --file $file --type csv --headerline`
addToLog $Import
