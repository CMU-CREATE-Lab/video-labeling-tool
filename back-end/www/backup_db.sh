#!/bin/sh

P=""
if [ "$2" != "" ]
then
  P="$2"
fi

E="development"
if [ "$1" != "" ]
then
  E="$1"
fi

D=$(date +%m%d%Y)

if [ "$E" = "production" ]
then
  sudo mysqldump -u root -p video_labeling_tool_production >"$P"video_labeling_tool_production_"$D".out
elif [ "$E" = "development" ]
then
  sudo mysqldump -u root -p video_labeling_tool_development >"$P"video_labeling_tool_development_"$D".out
fi
